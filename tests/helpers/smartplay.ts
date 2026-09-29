import { findBrew } from '../../src/core/brewing';
import {
  cannotPlayReason,
  cardNeedsTarget,
  endTurn,
  isAlive,
  playCard,
  potionNeedsTarget,
  usePotion,
} from '../../src/core/combat';
import { createGrimoire } from '../../src/core/grimoire';
import { Rng } from '../../src/core/rng';
import {
  addCardToDeck,
  availableNodes,
  buyCard,
  buyPotion,
  buyRelic,
  canInfuse,
  createRun,
  enterNode,
  finishFight,
  infuseCard,
  removeCard,
  rest,
  startFight,
  type RunState,
} from '../../src/core/run';
import type { CardDef, CombatEvent, CombatState, Effect } from '../../src/core/types';
import { blockPersists } from '../../src/core/weather';
import { getCard } from '../../src/data/cards';
import type { EventOutcome } from '../../src/data/events';
import { playEvent, type EventPolicy } from './autoplay';

/**
 * A heuristic player for balance testing. In fights it tries every playable
 * card (and potion), simulates the rest of the round on a copy of the fight,
 * and plays the one that leaves the best position, until ending the turn is
 * best. It also picks the better of Out and Cover the same way. It knows the
 * fight's random seed, so it plays a little better than a person would.
 */

const W_HP = 1;
/** Enemy HP is worth a bit less than your own: dealing damage also shortens the fight. */
const W_ENEMY = 0.7;
const KILL_BONUS = 12;
const POTION_VALUE = 8;
const WIN_VALUE = 1000;

type Action = { kind: 'card'; uid: number; target?: number } | { kind: 'potion'; index: number; target?: number };

const clone = (s: CombatState): CombatState => structuredClone(s);

/** Total damage a Burn of this size deals before it runs out. */
const burnTotal = (burn = 0) => (burn * (burn + 1)) / 2;

/** A rough worth of effects, used for the cauldron's contents and for picking cards. */
export function effectsValue(effects: readonly Effect[], enemies = 1): number {
  let value = 0;
  for (const e of effects) {
    switch (e.type) {
      case 'damage':
        value += e.amount * (e.all ? enemies : 1) * W_ENEMY;
        break;
      case 'block':
        value += e.amount * 0.5;
        break;
      case 'heal':
        value += e.amount * 0.8;
        break;
      case 'draw':
        value += e.amount * 2;
        break;
      case 'energy':
        value += e.amount * 3;
        break;
      case 'applyStatus':
        value += e.amount * (e.status === 'weak' ? 2 : 1.5) * (e.all ? enemies : 1);
        break;
      case 'addElement':
        value += 2;
        break;
      case 'brew':
        value += 3;
        break;
      case 'bottle':
        value += 2;
        break;
      case 'steal':
      case 'spoil':
        value += 1.5;
        break;
      default:
        value += 1.5;
    }
  }
  return value;
}

/** How good a position is (after the enemies have acted). */
function score(s: CombatState): number {
  if (s.status === 'lost') return -WIN_VALUE;
  const p = s.player;
  let value = p.hp * W_HP + s.potions.length * POTION_VALUE;
  if (s.status === 'won') return WIN_VALUE + value;
  value -= burnTotal(p.statuses.burn) * W_HP + (p.statuses.weak ?? 0) * 2;
  if (blockPersists(s.weather.current)) value += p.block * 0.4;
  const living = s.enemies.filter(isAlive).length;
  for (const e of s.enemies) {
    if (!isAlive(e)) {
      value += KILL_BONUS;
      continue;
    }
    value -= (e.hp + e.block * 0.8) * W_ENEMY;
    value += burnTotal(e.statuses.burn) * W_ENEMY + (e.statuses.weak ?? 0) * 2 + (e.spoiled ? 3 : 0);
  }
  if (s.cauldron.length) value += effectsValue(findBrew(s.cauldron).recipe.effects, living) * 0.6;
  return value + s.bottleNext * 2;
}

/**
 * Imagined futures: the rest of the round is played out with these made-up
 * random seeds instead of the fight's real one, so the player can't know where
 * lightning will strike; it averages over them.
 */
const IMAGINED_SEEDS = [0x9e3779b9, 0x85ebca6b];

/** The value of ending the turn now, with the better stance. */
function endTurnValue(s: CombatState): { value: number; exposed: boolean } {
  let best = { value: -Infinity, exposed: s.player.exposed };
  for (const exposed of [true, false]) {
    let total = 0;
    for (const seed of IMAGINED_SEEDS) {
      const c = clone(s);
      c.rngState = (s.rngState ^ seed) >>> 0;
      c.player.exposed = exposed;
      endTurn(c);
      total += score(c);
    }
    const value = total / IMAGINED_SEEDS.length;
    if (value > best.value) best = { value, exposed };
  }
  return best;
}

function candidates(s: CombatState): Action[] {
  const living = s.enemies.flatMap((e, i) => (isAlive(e) ? [i] : []));
  const actions: Action[] = [];
  const seen = new Set<string>();
  for (const card of s.hand) {
    const key = `${card.defId}/${card.infusion ?? ''}`;
    if (seen.has(key) || cannotPlayReason(s, card) !== null) continue;
    seen.add(key);
    for (const target of cardNeedsTarget(s, card) ? living : [undefined]) actions.push({ kind: 'card', uid: card.uid, target });
  }
  s.potions.forEach((_, index) => {
    for (const target of potionNeedsTarget(s, index) ? living : [undefined]) actions.push({ kind: 'potion', index, target });
  });
  return actions;
}

function apply(s: CombatState, action: Action): CombatEvent[] | null {
  const result = action.kind === 'card' ? playCard(s, action.uid, action.target) : usePotion(s, action.index, action.target);
  return result.ok ? result.events : null;
}

/** Plays one turn (not ending it) and picks the stance. Returns the events of the cards played. */
export function smartTurn(s: CombatState): CombatEvent[] {
  const events: CombatEvent[] = [];
  for (let step = 0; step < 15 && s.status === 'playing'; step++) {
    let best: Action | undefined;
    let bestValue = endTurnValue(s).value + 0.01;
    for (const action of candidates(s)) {
      const c = clone(s);
      if (!apply(c, action)) continue;
      const value = c.status === 'playing' ? endTurnValue(c).value : score(c);
      if (value > bestValue) {
        bestValue = value;
        best = action;
      }
    }
    if (!best) break;
    events.push(...(apply(s, best) ?? []));
  }
  if (s.status === 'playing') s.player.exposed = endTurnValue(s).exposed;
  return events;
}

export interface FightStats {
  enemies: string;
  turns: number;
  hpLost: number;
  won: boolean;
  weatherChanges: number;
  /** Changes that came from the schedule (not from cards or enemies). */
  scheduledChanges: number;
  /** Different weathers seen during the fight. */
  weathersSeen: number;
  caught: number;
  spilled: number;
  brews: number;
  enemyBrews: number;
  potionsUsed: number;
}

/** Plays a whole fight with the heuristic player. */
export function smartFight(s: CombatState): FightStats {
  const stats: FightStats = {
    enemies: s.enemies.map((e) => e.defId).join('+'),
    turns: 0,
    hpLost: 0,
    won: false,
    weatherChanges: 0,
    scheduledChanges: 0,
    weathersSeen: 0,
    caught: 0,
    spilled: 0,
    brews: 0,
    enemyBrews: 0,
    potionsUsed: 0,
  };
  const startHp = s.player.hp;
  const seen = new Set([s.weather.current]);
  const count = (events: CombatEvent[]) => {
    for (const e of events) {
      if (e.type === 'weather' && e.from !== e.to) {
        stats.weatherChanges++;
        if (e.cause === 'schedule') stats.scheduledChanges++;
        seen.add(e.to);
      } else if (e.type === 'element' && e.fromWeather) stats.caught++;
      else if (e.type === 'spill') stats.spilled++;
      else if (e.type === 'brew') stats.brews++;
      else if (e.type === 'enemyBrew') stats.enemyBrews++;
      else if (e.type === 'potion') stats.potionsUsed++;
    }
  };
  for (let turn = 0; turn < 60 && s.status === 'playing'; turn++) {
    count(smartTurn(s));
    if (s.status === 'playing') count(endTurn(s));
  }
  stats.turns = s.turn;
  stats.weathersSeen = seen.size;
  stats.hpLost = startHp - Math.max(0, s.player.hp);
  stats.won = s.status === 'won';
  return stats;
}

// ---------- Run decisions ----------

/** How much a card is worth adding to the deck (energy costs about 3 points). */
export function cardValue(def: CardDef): number {
  return effectsValue(def.effects) - def.cost * 3;
}

function pickReward(choices: readonly string[], rng: Rng): string | undefined {
  let best: string | undefined;
  let bestValue = 0.5;
  for (const id of choices) {
    const value = cardValue(getCard(id)) + rng.next() * 2;
    if (value > bestValue) {
      bestValue = value;
      best = id;
    }
  }
  return best;
}

function visitShop(run: RunState, rng: Rng): void {
  const shop = run.shop;
  if (!shop) return;
  const basic = run.deck.findIndex((c) => c.id === 'strike');
  const removable = basic >= 0 ? basic : run.deck.findIndex((c) => c.id === 'defend');
  if (removable >= 0 && run.gold >= shop.removalPrice + 40) removeCard(run, removable);
  shop.relics.forEach((item, i) => {
    if (!item.sold && run.gold >= item.price) buyRelic(run, i);
  });
  shop.cards.forEach((item, i) => {
    if (!item.sold && run.gold >= item.price && cardValue(getCard(item.id)) + rng.next() * 2 > 3) buyCard(run, i);
  });
  if (run.potions.length < 2 && shop.potions[0] && run.gold >= shop.potions[0].price) buyPotion(run, 0);
}

function visitRest(run: RunState, rng: Rng): void {
  if (run.maxHp - run.hp >= 18) {
    rest(run);
    return;
  }
  const options = run.deck.flatMap((c, i) => (canInfuse(c) && getCard(c.id).cost > 0 ? [i] : []));
  if (options.length) infuseCard(run, rng.pick(options), rng.pick(['fire', 'water', 'earth', 'air'] as const));
  else rest(run);
}

/** How much an event outcome is worth to the heuristic player right now. */
function outcomeValue(run: RunState, o: EventOutcome): number {
  const health = run.hp / run.maxHp;
  switch (o.type) {
    case 'heal':
      return Math.min(o.amount, run.maxHp - run.hp);
    case 'maxHp':
      return o.amount * 1.5;
    case 'gold':
      return o.amount * 0.15;
    case 'loseHp':
      return -o.amount * (health < 0.5 ? 2 : 1);
    case 'relic':
      return 20;
    case 'potion':
      return 8;
    case 'learn':
      return 1;
    case 'eliteFight':
      return health > 0.7 ? 12 : -20;
    default:
      return 3;
  }
}

const smartEventPolicy = (run: RunState, rng: Rng): EventPolicy => ({
  choose: (options) => {
    const value = (o: (typeof options)[number]) => o.outcomes.reduce((sum, x) => sum + outcomeValue(run, x), 0) + rng.next();
    return options.reduce((best, o) => (value(o) > value(best) ? o : best));
  },
  // Trade away or infuse the weakest cards first: Strikes and Defends.
  card: (indices) => indices.find((i) => ['strike', 'defend'].includes(run.deck[i]?.id ?? '')) ?? rng.pick(indices),
  sky: (ids) => rng.int(0, ids.length - 1),
});

/** Picks where to go next: rest when hurt, elites when healthy, shops with gold. */
function pickNode(run: RunState, rng: Rng): string | undefined {
  const next = availableNodes(run);
  const health = run.hp / run.maxHp;
  let best: string | undefined;
  let bestValue = -Infinity;
  for (const node of next) {
    let value = rng.next() * 2;
    if (node.type === 'rest') value += health < 0.5 ? 6 : 1;
    if (node.type === 'elite') value += health > 0.75 ? 3 : -6;
    if (node.type === 'shop') value += run.gold >= 110 ? 4 : -1;
    if (node.type === 'event') value += 1.5;
    if (node.type === 'fight') value += health > 0.4 ? 2 : 0;
    if (value > bestValue) {
      bestValue = value;
      best = node.id;
    }
  }
  return best;
}

export interface RunStats {
  won: boolean;
  /** The floor the run ended on (the boss is floor MAP_FLOORS). */
  floor: number;
  fights: FightStats[];
  hpAtBoss?: number;
  deckSize: number;
  relics: number;
  gold: number;
}

/** Plays a whole run with the heuristic player. */
export function smartRun(seed: number): { run: RunState; stats: RunStats } {
  const rng = new Rng(seed * 7919 + 17);
  const run = createRun(seed);
  const grimoire = createGrimoire();
  const stats: RunStats = { won: false, floor: 0, fights: [], deckSize: 0, relics: 0, gold: 0 };
  for (let step = 0; step < 30 && run.status === 'playing'; step++) {
    const id = pickNode(run, rng);
    if (!id) break;
    const node = enterNode(run, id);
    stats.floor = node.floor;
    if (node.type === 'rest') visitRest(run, rng);
    else if (node.type === 'shop') visitShop(run, rng);
    else if (node.type === 'event' && !playEvent(run, grimoire, smartEventPolicy(run, rng))) continue;
    else {
      if (node.type === 'boss') stats.hpAtBoss = run.hp;
      const { state } = startFight(run);
      stats.fights.push(smartFight(state));
      const rewards = finishFight(run, state);
      const pick = run.status === 'playing' ? pickReward(rewards.cardChoices, rng) : undefined;
      if (pick) addCardToDeck(run, pick);
    }
  }
  stats.won = run.status === 'won';
  stats.deckSize = run.deck.length;
  stats.relics = run.relics.length;
  stats.gold = run.gold;
  return { run, stats };
}
