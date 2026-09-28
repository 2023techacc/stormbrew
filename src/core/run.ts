import { REWARD_POOL, STARTER_DECK, getCard } from '../data/cards';
import { ENCOUNTERS } from '../data/enemies';
import { RECIPES } from '../data/recipes';
import { RELIC_POOL, STARTING_RELICS, getRelic } from '../data/relics';
import { SKY_POOL, STARTING_SKY, getSkyCard } from '../data/sky';
import { MAX_POTIONS, createCombat } from './combat';
import { generateMap, reachableNodes, type MapNode, type MapState } from './map';
import { Rng } from './rng';
import type { CombatEvent, CombatState, DeckCard, ElementId } from './types';

export const PLAYER_MAX_HP = 75;
export const STARTING_GOLD = 50;
/** Floors (from 0) that use easy encounters before normal fights get harder. */
export const EASY_FLOORS = 3;
export const REWARD_CHOICES = 3;
/** Resting heals this fraction of max HP. */
export const REST_HEAL = 0.3;
export const HEALING_HERB_HEAL = 6;
export const LUCKY_COIN_GOLD = 10;
export const GOLD_REWARD = { fight: [12, 18], elite: [28, 35] } as const;
export const SHOP_PRICES = { card: [40, 55], relic: [110, 140], potion: [30, 45], sky: [35, 50], removal: 60 } as const;
/** The sky deck can't be charted below this many cards. */
export const MIN_SKY = 2;
/** Chance that a won fight also drops a potion. */
export const POTION_DROP_CHANCE = 0.3;
/** Potions that can drop or be sold: the two-element base recipes. */
export const POTION_POOL = RECIPES.filter(
  (r) => r.elements.length === 2 && r.elements.every((e) => ['fire', 'water', 'earth', 'air'].includes(e)),
).map((r) => r.id);
export const INFUSE_ELEMENTS: readonly ElementId[] = ['fire', 'water', 'earth', 'air'];

export type RunStatus = 'playing' | 'won' | 'lost';

export interface ShopItem {
  id: string;
  price: number;
  sold: boolean;
}

export interface ShopState {
  cards: ShopItem[];
  relics: ShopItem[];
  potions: ShopItem[];
  sky: ShopItem[];
  removalPrice: number;
  removalUsed: boolean;
}

/**
 * A run through Act 1: pick a path up the map to the boss. HP, gold, the deck
 * and relics carry over. Plain data so it can be saved as JSON.
 */
export interface RunState {
  rngState: number;
  hp: number;
  maxHp: number;
  gold: number;
  deck: DeckCard[];
  relics: string[];
  /** Bottled brews (recipe ids), at most MAX_POTIONS. */
  potions: string[];
  /** The sky deck: weather cards the forecast is drawn from in every fight. */
  sky: string[];
  map: MapState;
  /** The node the player is on, or null before the first move. */
  nodeId: string | null;
  /** Nodes visited so far, in order (the path taken). */
  visited: string[];
  fightsWon: number;
  status: RunStatus;
  /** The stock of the shop the player is in. */
  shop?: ShopState;
}

export interface FightRewards {
  gold: number;
  healed: number;
  relic?: string;
  /** A potion found after the fight (already added if there was room). */
  potion?: string;
  cardChoices: string[];
}

/**
 * Where the player is in the run, so a saved run can resume on the same screen.
 * During a fight the fight itself is saved separately.
 */
export type RunScreen =
  | { name: 'map' }
  | { name: 'combat'; label: string }
  | { name: 'reward'; rewards: FightRewards }
  | { name: 'rest'; step: 'choose' | 'pickCard' | 'pickElement' | 'pickSky'; deckIndex?: number }
  | { name: 'shop'; removing: boolean }
  | { name: 'over' };

export function createRun(seed: number): RunState {
  const rng = new Rng(seed);
  const map = generateMap(rng);
  return {
    rngState: rng.getState(),
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    gold: STARTING_GOLD,
    deck: STARTER_DECK.map((id) => ({ id })),
    relics: [...STARTING_RELICS],
    potions: [],
    sky: [...STARTING_SKY],
    map,
    nodeId: null,
    visited: [],
    fightsWon: 0,
    status: 'playing',
  };
}

export function currentNode(run: RunState): MapNode | undefined {
  return run.nodeId === null ? undefined : run.map.nodes[run.nodeId];
}

export function availableNodes(run: RunState): MapNode[] {
  return run.status === 'playing' ? reachableNodes(run.map, run.nodeId) : [];
}

/** Moves to a reachable node. Entering a shop stocks it. */
export function enterNode(run: RunState, id: string): MapNode {
  const node = availableNodes(run).find((n) => n.id === id);
  if (!node) throw new Error(`Node ${id} is not reachable`);
  run.nodeId = id;
  run.visited.push(id);
  delete run.shop;
  if (node.type === 'shop') run.shop = createShop(run);
  return node;
}

/** Starts the fight at the current node (fight, elite or boss). */
export function startFight(run: RunState): { state: CombatState; events: CombatEvent[] } {
  const node = currentNode(run);
  if (!node || (node.type !== 'fight' && node.type !== 'elite' && node.type !== 'boss')) {
    throw new Error('Not at a fight');
  }
  const tier =
    node.type === 'boss'
      ? ENCOUNTERS.boss
      : node.type === 'elite'
        ? ENCOUNTERS.elite
        : node.floor < EASY_FLOORS
          ? ENCOUNTERS.easy
          : ENCOUNTERS.hard;
  const { enemies, seed } = withRng(run, (rng) => ({ enemies: rng.pick(tier), seed: rng.int(0, 2 ** 32 - 1) }));
  return createCombat({
    seed,
    deck: run.deck,
    enemies,
    playerHp: run.hp,
    playerMaxHp: run.maxHp,
    relics: run.relics,
    potions: run.potions,
    sky: run.sky,
  });
}

/**
 * Records a finished fight and gives its rewards: gold (and a relic from elites)
 * right away, plus card choices for the player to pick from. Beating the boss
 * wins the run; losing ends it.
 */
export function finishFight(run: RunState, combat: CombatState): FightRewards {
  const none: FightRewards = { gold: 0, healed: 0, cardChoices: [] };
  if (combat.status !== 'won') {
    run.hp = 0;
    run.status = 'lost';
    return none;
  }
  run.fightsWon += 1;
  run.hp = combat.player.hp;
  run.potions = [...combat.potions];
  const node = currentNode(run);
  if (node?.type === 'boss') {
    run.status = 'won';
    return none;
  }

  const healed = run.relics.includes('healingHerb') ? heal(run, HEALING_HERB_HEAL) : 0;
  const [min, max] = node?.type === 'elite' ? GOLD_REWARD.elite : GOLD_REWARD.fight;
  const gold =
    withRng(run, (rng) => rng.int(min, max)) + (run.relics.includes('luckyCoin') ? LUCKY_COIN_GOLD : 0);
  run.gold += gold;

  const rewards: FightRewards = { gold, healed, cardChoices: rewardChoices(run) };
  const potion = withRng(run, (rng) => (rng.next() < POTION_DROP_CHANCE ? rng.pick(POTION_POOL) : undefined));
  if (potion && run.potions.length < MAX_POTIONS) {
    run.potions.push(potion);
    rewards.potion = potion;
  }
  if (node?.type === 'elite') {
    const relic = randomRelic(run);
    if (relic) {
      run.relics.push(relic);
      rewards.relic = relic;
    }
  }
  return rewards;
}

/** Distinct cards to choose from after a victory. */
export function rewardChoices(run: RunState): string[] {
  return withRng(run, (rng) => rng.shuffle(REWARD_POOL).slice(0, REWARD_CHOICES));
}

export function addCardToDeck(run: RunState, cardId: string): void {
  getCard(cardId); // throws on unknown ids
  run.deck.push({ id: cardId });
}

// ---------- Rest sites ----------

export function restHealAmount(run: RunState): number {
  return Math.min(Math.ceil(run.maxHp * REST_HEAL), run.maxHp - run.hp);
}

export function rest(run: RunState): number {
  return heal(run, Math.ceil(run.maxHp * REST_HEAL));
}

/** Infusing permanently adds an element to a card: playing it also adds that element. */
export function canInfuse(card: DeckCard): boolean {
  return card.infusion === undefined;
}

export function infuseCard(run: RunState, deckIndex: number, element: ElementId): void {
  const card = run.deck[deckIndex];
  if (!card || !canInfuse(card)) throw new Error('That card cannot be infused');
  if (!INFUSE_ELEMENTS.includes(element)) throw new Error(`Cannot infuse ${element}`);
  card.infusion = element;
}

// ---------- Shops ----------

function createShop(run: RunState): ShopState {
  return withRng(run, (rng) => {
    const cards = rng.shuffle(REWARD_POOL).slice(0, 3);
    const relics = rng.shuffle(RELIC_POOL.filter((id) => !run.relics.includes(id))).slice(0, 2);
    const potion = rng.pick(POTION_POOL);
    const sky = rng.pick(SKY_POOL);
    return {
      cards: cards.map((id) => ({ id, price: rng.int(...SHOP_PRICES.card), sold: false })),
      relics: relics.map((id) => ({ id, price: rng.int(...SHOP_PRICES.relic), sold: false })),
      potions: [{ id: potion, price: rng.int(...SHOP_PRICES.potion), sold: false }],
      sky: [{ id: sky, price: rng.int(...SHOP_PRICES.sky), sold: false }],
      removalPrice: SHOP_PRICES.removal,
      removalUsed: false,
    };
  });
}

export type ShopResult = { ok: true } | { ok: false; reason: string };

function pay(run: RunState, price: number): ShopResult {
  if (!run.shop) return { ok: false, reason: 'You are not in a shop.' };
  if (run.gold < price) return { ok: false, reason: 'Not enough gold.' };
  run.gold -= price;
  return { ok: true };
}

export function buyCard(run: RunState, index: number): ShopResult {
  const item = run.shop?.cards[index];
  if (!item || item.sold) return { ok: false, reason: 'Sold out.' };
  const paid = pay(run, item.price);
  if (!paid.ok) return paid;
  item.sold = true;
  addCardToDeck(run, item.id);
  return paid;
}

export function buyRelic(run: RunState, index: number): ShopResult {
  const item = run.shop?.relics[index];
  if (!item || item.sold) return { ok: false, reason: 'Sold out.' };
  const paid = pay(run, item.price);
  if (!paid.ok) return paid;
  item.sold = true;
  run.relics.push(getRelic(item.id).id);
  return paid;
}

export function buyPotion(run: RunState, index: number): ShopResult {
  const item = run.shop?.potions[index];
  if (!item || item.sold) return { ok: false, reason: 'Sold out.' };
  if (run.potions.length >= MAX_POTIONS) return { ok: false, reason: 'Your potion belt is full.' };
  const paid = pay(run, item.price);
  if (!paid.ok) return paid;
  item.sold = true;
  run.potions.push(item.id);
  return paid;
}

/** Buys a weather card for the sky deck. */
export function buySky(run: RunState, index: number): ShopResult {
  const item = run.shop?.sky[index];
  if (!item || item.sold) return { ok: false, reason: 'Sold out.' };
  const paid = pay(run, item.price);
  if (!paid.ok) return paid;
  item.sold = true;
  run.sky.push(getSkyCard(item.id).id);
  return paid;
}

/** Rest site option: take a weather card out of the sky deck. */
export function chartSky(run: RunState, index: number): ShopResult {
  if (run.sky.length <= MIN_SKY) return { ok: false, reason: `Your sky needs at least ${MIN_SKY} weathers.` };
  if (run.sky[index] === undefined) return { ok: false, reason: 'No such weather.' };
  run.sky.splice(index, 1);
  return { ok: true };
}

/** Removes a card from the deck, once per shop visit. */
export function removeCard(run: RunState, deckIndex: number): ShopResult {
  if (!run.shop || run.shop.removalUsed) return { ok: false, reason: 'Card removal is used up.' };
  if (!run.deck[deckIndex]) return { ok: false, reason: 'No such card.' };
  if (run.deck.length <= 1) return { ok: false, reason: 'Your deck needs at least one card.' };
  const paid = pay(run, run.shop.removalPrice);
  if (!paid.ok) return paid;
  run.shop.removalUsed = true;
  run.deck.splice(deckIndex, 1);
  return paid;
}

// ---------- Helpers ----------

function heal(run: RunState, amount: number): number {
  const healed = Math.min(amount, run.maxHp - run.hp);
  run.hp += healed;
  return healed;
}

function randomRelic(run: RunState): string | undefined {
  const options = RELIC_POOL.filter((id) => !run.relics.includes(id));
  return options.length ? withRng(run, (rng) => rng.pick(options)) : undefined;
}

function withRng<T>(run: RunState, fn: (rng: Rng) => T): T {
  const rng = Rng.fromState(run.rngState);
  const result = fn(rng);
  run.rngState = rng.getState();
  return result;
}
