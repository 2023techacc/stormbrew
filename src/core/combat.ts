import { getCard } from '../data/cards';
import { getEnemy } from '../data/enemies';
import { RECIPES, SLUDGE, getRecipe } from '../data/recipes';
import { t } from '../i18n';
import { CAULDRON_SLOTS, WEATHER_ELEMENTS, effectsNeedTarget, findBrew, type BrewResult } from './brewing';
import { dealDamage, gainBlock } from './effects';
import { Rng } from './rng';
import type {
  CardInstance,
  DeckCard,
  Effect,
  CombatEvent,
  CombatState,
  Combatant,
  EnemyMove,
  ElementId,
  EnemyState,
  LastingId,
  RecipeDef,
  UnitRef,
  WeatherId,
} from './types';
import {
  HEATWAVE_BURN,
  STORM_BOLT_DAMAGE,
  addToSky,
  advanceWeather,
  blockPersists,
  createWeather,
  isChangeDue,
  modifyDamage,
  overrideWeather,
  scatterForecast,
  skyWeather,
} from './weather';

export const HAND_SIZE = 5;
export const MAX_HAND_SIZE = 10;
export const PLAYER_MAX_ENERGY = 3;
/** Weak units deal this much less attack damage. */
export const WEAK_MULTIPLIER = 0.75;

export const BASE_ELEMENTS: readonly ElementId[] = ['fire', 'water', 'earth', 'air'];
export const WEATHERVANE_BLOCK = 3;
/** Potions you can carry (the Bottomless Flask adds more). */
export const MAX_POTIONS = 3;
export const BOTTOMLESS_FLASK_POTIONS = 2;
/** Boss relics that give 1 extra energy each turn (each with a catch). */
export const ENERGY_RELICS: readonly string[] = ['stormVow', 'skyAnchor', 'philosophersStone'];
export const SNOW_GLOBE_BLOCK = 3;
/** Lasting cards: the Conductor's damage to every enemy when the weather changes, Steady Hands' Block per brew. */
export const CONDUCTOR_DAMAGE = 5;
export const STEADY_HANDS_BLOCK = 4;
export const UMBRELLA_BLOCK = 4;
export const DEWCATCHER_BLOCK = 2;
/** What the Alembic can turn Sludge into: the recipes made of two base elements. */
export const BASIC_RECIPES = RECIPES.filter(
  (r) => r.elements.length === 2 && r.elements.every((e) => BASE_ELEMENTS.includes(e)),
).map((r) => r.id);

export interface CombatSetup {
  seed: number;
  /** Card ids, or deck cards with infusions. */
  deck: Array<string | DeckCard>;
  enemies: string[];
  playerHp: number;
  playerMaxHp: number;
  startWeather?: WeatherId;
  relics?: string[];
  potions?: string[];
  /** The run's sky deck (weather cards) the forecast is drawn from. */
  sky?: string[];
}

export type PlayResult = { ok: true; events: CombatEvent[] } | { ok: false; reason: string };

export function hasRelic(state: CombatState, relic: string): boolean {
  return state.relics.includes(relic);
}

/** How many potions fit in the belt with these relics. */
export function potionCapacity(relics: readonly string[]): number {
  return MAX_POTIONS + (relics.includes('bottomlessFlask') ? BOTTOMLESS_FLASK_POTIONS : 0);
}

/** How many copies of a Lasting card have been played this fight. */
export function lastingCount(state: CombatState, card: LastingId): number {
  return state.lasting[card] ?? 0;
}

/** Whether the player can step under cover (the Storm Vow keeps them out in the open). */
export function canTakeCover(state: CombatState): boolean {
  return !hasRelic(state, 'stormVow');
}

/** Whether a card's Attuned bonus is active in this weather. */
export function isAttuned(defId: string, weather: WeatherId): boolean {
  return getCard(defId).attuned?.weather === weather;
}

/** A card's effects in this weather: its own, its Attuned bonus, then its infusion's element. */
export function cardEffects(card: CardInstance, weather: WeatherId): Effect[] {
  const def = getCard(card.defId);
  const attuned = def.attuned?.weather === weather ? def.attuned.effects : [];
  const infusion: Effect[] = card.infusion ? [{ type: 'addElement', element: card.infusion }] : [];
  return [...def.effects, ...attuned, ...infusion];
}

/** Creates a fight and starts the player's first turn. */
export function createCombat(setup: CombatSetup): { state: CombatState; events: CombatEvent[] } {
  const rng = new Rng(setup.seed);
  const relics = setup.relics ?? [];
  const deck: CardInstance[] = setup.deck.map((card, uid) => {
    const { id, infusion } = typeof card === 'string' ? { id: card, infusion: undefined } : card;
    return infusion ? { uid, defId: id, infusion } : { uid, defId: id };
  });
  const cauldron: ElementId[] = relics.includes('copperCauldron') ? [rng.pick(BASE_ELEMENTS)] : [];
  // The Bottomless Flask brings a random potion to every fight, if there's room.
  const potions = [...(setup.potions ?? [])];
  const flask = relics.includes('bottomlessFlask') && potions.length < potionCapacity(relics);
  if (flask) potions.push(rng.pick(BASIC_RECIPES));
  // Cloud Seed: the fight starts in a weather from the sky instead of Clear.
  const start = setup.startWeather ?? (relics.includes('cloudSeed') ? 'sky' : 'clear');
  const state: CombatState = {
    player: {
      hp: setup.playerHp,
      maxHp: setup.playerMaxHp,
      block: 0,
      statuses: {},
      energy: 0,
      maxEnergy: PLAYER_MAX_ENERGY + ENERGY_RELICS.filter((id) => relics.includes(id)).length,
      exposed: true,
    },
    enemies: setup.enemies.map((id) => {
      const def = getEnemy(id);
      return {
        defId: id,
        name: def.name,
        hp: def.maxHp,
        maxHp: def.maxHp,
        block: 0,
        statuses: {},
        moveIndex: 0,
        cauldron: [],
        gatherIndex: 0,
        spoiled: false,
      };
    }),
    drawPile: rng.shuffle(deck),
    hand: [],
    discardPile: [],
    turn: 0,
    weather: createWeather(rng, start, setup.sky),
    cauldron,
    cauldronSlots:
      CAULDRON_SLOTS + (relics.includes('ironCauldron') ? 1 : 0) - (relics.includes('philosophersStone') ? 1 : 0),
    relics: [...relics],
    potions,
    bottleNext: 0,
    doubleNext: 0,
    brewed: [],
    lasting: {},
    status: 'playing',
    rngState: rng.getState(),
  };
  const events: CombatEvent[] = flask ? [{ type: 'relic', relic: 'bottomlessFlask' }] : [];
  return { state, events: [...events, ...startPlayerTurn(state)] };
}

/** Whether an enemy has reached its second phase (if it has one). */
export function inPhase2(enemy: EnemyState): boolean {
  const phase2 = getEnemy(enemy.defId).phase2;
  return phase2 !== undefined && enemy.hp <= enemy.maxHp * phase2.below;
}

/** The move an enemy will make at the end of this turn (its intent). */
export function currentIntent(enemy: EnemyState): EnemyMove {
  const def = getEnemy(enemy.defId);
  const moves = inPhase2(enemy) && def.phase2 ? def.phase2.moves : def.moves;
  return moves[enemy.moveIndex % moves.length] as EnemyMove;
}

export function isAlive(unit: Combatant): boolean {
  return unit.hp > 0;
}

/** Whether an enemy ignores the harmful effects of a weather. */
export function isWeathered(enemy: EnemyState, weather: WeatherId): boolean {
  return getEnemy(enemy.defId).weathered?.includes(weather) ?? false;
}

/** Why a card can't be played right now, or null if it can. */
export function cannotPlayReason(state: CombatState, card: CardInstance): string | null {
  if (state.status !== 'playing') return t('err.fightOver');
  if (!state.hand.some((c) => c.uid === card.uid)) return t('err.notInHand');
  const effects = cardEffects(card, state.weather.current);
  if (getCard(card.defId).cost > state.player.energy) return t('err.noEnergy');
  if (usesCauldronOnly(effects) && state.cauldron.length === 0) return t('err.emptyCauldron');
  return null;
}

/** A card like Stir or Boil Over that does nothing but use what is in the cauldron. */
function usesCauldronOnly(effects: readonly Effect[]): boolean {
  return effects.every((e) => e.type === 'brew' || e.type === 'boilOver');
}

/**
 * What playing this card would brew (the first brew it triggers), or null if it
 * doesn't brew. Used for previews and to decide whether the card needs a target.
 * Pass a card definition, or `{ effects: cardEffects(instance) }` for an infused card.
 */
export function previewCardBrew(state: CombatState, card: { effects: readonly Effect[] }): BrewResult | null {
  const cauldron = [...state.cauldron];
  for (const effect of card.effects) {
    const element = effect.type === 'catchWeather' ? WEATHER_ELEMENTS[state.weather.current] : undefined;
    if (effect.type === 'addElement' || element) {
      // A full cauldron brews first to make room.
      if (cauldron.length >= state.cauldronSlots) return findBrew(cauldron);
      cauldron.push(effect.type === 'addElement' ? effect.element : (element as ElementId));
    }
    if (effect.type === 'brew') return cauldron.length > 0 ? findBrew(cauldron) : null;
    if (effect.type === 'boilOver') cauldron.length = 0;
  }
  return null;
}

/** Whether playing this card needs an enemy chosen (for itself or the brew it triggers). */
export function cardNeedsTarget(state: CombatState, card: CardInstance): boolean {
  if (getCard(card.defId).target === 'enemy') return true;
  const brew = previewCardBrew(state, { effects: cardEffects(card, state.weather.current) });
  return brew !== null && effectsNeedTarget(brew.recipe.effects);
}

export function playCard(state: CombatState, uid: number, targetIndex?: number): PlayResult {
  const card = state.hand.find((c) => c.uid === uid);
  if (!card) return { ok: false, reason: t('err.notInHand') };
  const reason = cannotPlayReason(state, card);
  if (reason) return { ok: false, reason };

  const def = getCard(card.defId);
  let target: number | undefined;
  if (cardNeedsTarget(state, card)) {
    const enemy = targetIndex === undefined ? undefined : state.enemies[targetIndex];
    if (targetIndex === undefined || !enemy || !isAlive(enemy)) {
      return { ok: false, reason: t('err.chooseEnemy') };
    }
    target = targetIndex;
  }

  // Attuned bonuses count the weather the card is played in.
  const effects = cardEffects(card, state.weather.current);
  state.player.energy -= def.cost;
  state.hand = state.hand.filter((c) => c.uid !== uid);
  const events = applyEffects(state, effects, target);
  // Discard after resolving, so a card that draws can't draw itself. A Lasting card leaves the fight instead.
  if (def.kind !== 'power') state.discardPile.push(card);
  updateStatus(state);
  return { ok: true, events };
}

/**
 * Ends the player's turn: discard the hand, then enemies act, then end-of-round
 * weather resolves, then the next turn starts.
 */
export function endTurn(state: CombatState): CombatEvent[] {
  if (state.status !== 'playing') return [];
  const events: CombatEvent[] = [];

  state.discardPile.push(...state.hand);
  state.hand = [];
  if (!canTakeCover(state)) state.player.exposed = true;
  events.push(...tickBurn(state, { side: 'player' }));
  if (state.player.statuses.weak) state.player.statuses.weak -= 1;
  updateStatus(state);

  state.enemies.forEach((enemy, index) => {
    if (!isAlive(enemy) || state.status !== 'playing') return;
    // Like the player, an enemy's Block wears off when its own turn starts.
    if (!blockPersists(state.weather.current)) enemy.block = 0;
    const move = currentIntent(enemy);
    events.push({ type: 'enemyMove', index, move });
    if (move.weather) events.push(...setWeather(state, move.weather, 'enemy'));
    // The Conductor can strike an enemy down as its own weather arrives.
    if (!isAlive(enemy)) return updateStatus(state);
    if (move.addSky) {
      const cards = move.addSky;
      withRng(state, (rng) => addToSky(state.weather, rng, cards));
      events.push({ type: 'skyAdded', index, cards });
    }
    const block = enemyMoveBlock(move, state.weather.current);
    if (block) {
      gainBlock(enemy, block);
      events.push({ type: 'block', target: { side: 'enemy', index }, amount: block });
    }
    if (move.heal) {
      const healed = Math.min(move.heal, enemy.maxHp - enemy.hp);
      enemy.hp += healed;
      events.push({ type: 'enemyHeal', index, amount: healed });
    }
    if (move.shatter && state.player.block > 0) {
      events.push({ type: 'shatter', amount: state.player.block });
      state.player.block = 0;
    }
    if (move.damage) {
      const amount = enemyAttackDamage(enemy, move, state.weather.current, state.player.exposed);
      for (let hit = 0; hit < (move.hits ?? 1) && isAlive(state.player); hit++) {
        const { blocked, hpLost } = dealDamage(state.player, amount);
        events.push({ type: 'damage', target: { side: 'player' }, amount: hpLost, blocked });
      }
    }
    if (move.status) {
      const { status, amount } = move.status;
      state.player.statuses[status] = (state.player.statuses[status] ?? 0) + amount;
      events.push({ type: 'status', target: { side: 'player' }, status, amount });
    }
    if (move.stealElement) {
      const element = state.cauldron.pop();
      if (element) {
        events.push({ type: 'steal', index, element });
        const own = getEnemy(enemy.defId).cauldron;
        if (own && enemy.cauldron.length < own.size) enemy.cauldron.push(element);
      }
    }
    enemy.moveIndex += 1;
    events.push(...enemyGatherAndBrew(state, index));
    events.push(...tickBurn(state, { side: 'enemy', index }));
    if (enemy.statuses.weak) enemy.statuses.weak -= 1;
    updateStatus(state);
  });

  if (state.status === 'playing' && state.weather.current === 'storm') {
    events.push(...stormBolt(state));
    updateStatus(state);
  }

  if (state.status === 'playing') events.push(...startPlayerTurn(state));
  return events;
}

/** How much the player's attack will hit for: weather first, then Weak. */
export function playerAttackDamage(
  state: CombatState,
  amount: number,
  element: ElementId | undefined,
): number {
  const modified = modifyDamage(amount, element, state.weather.current);
  return state.player.statuses.weak ? Math.floor(modified * WEAK_MULTIPLIER) : modified;
}

/**
 * How much an enemy's attack will hit for: its bonuses (Attuned, and against
 * a player out in the open), then weather, then Weak.
 */
export function enemyAttackDamage(enemy: EnemyState, move: EnemyMove, weather: WeatherId, playerExposed = false): number {
  const attuned = move.attuned?.weather === weather ? (move.attuned.damage ?? 0) : 0;
  const hunting = playerExposed ? (move.exposedBonus ?? 0) : 0;
  const amount = modifyDamage((move.damage ?? 0) + attuned + hunting, move.element, weather);
  return enemy.statuses.weak ? Math.floor(amount * WEAK_MULTIPLIER) : amount;
}

/** How much Block an enemy's move gives it in this weather. */
export function enemyMoveBlock(move: EnemyMove, weather: WeatherId): number {
  return (move.block ?? 0) + (move.attuned?.weather === weather ? (move.attuned.block ?? 0) : 0);
}

/**
 * Changes the weather outside the schedule and restarts the countdown, so the
 * new weather lasts a full interval of the player's turns. Setting the current
 * weather again extends it. The forecast is unchanged.
 */
export function setWeather(
  state: CombatState,
  weather: WeatherId,
  cause: 'player' | 'enemy',
): CombatEvent[] {
  const from = state.weather.current;
  // An enemy acts at the end of the round, so its weather starts counting next turn.
  const firstTurn = cause === 'enemy' ? state.turn + 1 : state.turn;
  withRng(state, (rng) => overrideWeather(state.weather, rng, weather, firstTurn));
  const events: CombatEvent[] = [{ type: 'weather', from, to: weather, cause }];
  if (from !== weather) events.push(...weatherChanged(state));
  return events;
}

/** What reacts to the weather changing: Weathervane (Block), Wind Chime (a card) and the Conductor (damage). */
function weatherChanged(state: CombatState): CombatEvent[] {
  const events: CombatEvent[] = [];
  const conductors = lastingCount(state, 'conductor');
  if (conductors > 0 && state.status === 'playing') {
    events.push({ type: 'lastingEffect', card: 'conductor' });
    state.enemies.forEach((enemy, index) => {
      if (!isAlive(enemy)) return;
      const { blocked, hpLost } = dealDamage(enemy, CONDUCTOR_DAMAGE * conductors);
      events.push({ type: 'damage', target: { side: 'enemy', index }, amount: hpLost, blocked });
    });
    updateStatus(state);
  }
  if (hasRelic(state, 'weathervane')) {
    gainBlock(state.player, WEATHERVANE_BLOCK);
    events.push(
      { type: 'relic', relic: 'weathervane' },
      { type: 'block', target: { side: 'player' }, amount: WEATHERVANE_BLOCK },
    );
  }
  if (hasRelic(state, 'windChime') && state.status === 'playing') {
    events.push({ type: 'relic', relic: 'windChime' }, ...drawCards(state, 1));
  }
  return events;
}

function startPlayerTurn(state: CombatState): CombatEvent[] {
  const events: CombatEvent[] = [];
  state.turn += 1;

  let changed = false;
  if (!canTakeCover(state)) state.player.exposed = true;
  // The Sky Anchor holds the weather: only cards and enemies change it.
  if (isChangeDue(state.weather, state.turn) && !hasRelic(state, 'skyAnchor')) {
    const from = state.weather.current;
    const to = withRng(state, (rng) => advanceWeather(state.weather, rng, state.turn));
    changed = from !== to;
    if (changed) events.push({ type: 'weather', from, to, cause: 'schedule' });
  }

  if (!blockPersists(state.weather.current)) state.player.block = 0;
  // After Block resets, so a scheduled change's Weathervane Block lasts this turn.
  if (changed) events.push(...weatherChanged(state));
  if (state.status !== 'playing') return events;
  if (!state.player.exposed && hasRelic(state, 'umbrella')) {
    gainBlock(state.player, UMBRELLA_BLOCK);
    events.push({ type: 'relic', relic: 'umbrella' }, { type: 'block', target: { side: 'player' }, amount: UMBRELLA_BLOCK });
  }

  const weather = state.weather.current;
  if (weather === 'heatwave') {
    for (const ref of livingUnits(state, 'heatwave')) {
      const unit = getUnit(state, ref);
      unit.statuses.burn = (unit.statuses.burn ?? 0) + HEATWAVE_BURN;
      events.push({ type: 'status', target: ref, status: 'burn', amount: HEATWAVE_BURN });
    }
  }

  events.push(...catchWeather(state));

  state.player.energy = state.player.maxEnergy;
  if (weather === 'rain' && hasRelic(state, 'rainBarrel')) {
    state.player.energy += 1;
    events.push({ type: 'relic', relic: 'rainBarrel' });
  }
  if (weather === 'snow' && hasRelic(state, 'snowGlobe')) {
    gainBlock(state.player, SNOW_GLOBE_BLOCK);
    events.push({ type: 'relic', relic: 'snowGlobe' });
    events.push({ type: 'block', target: { side: 'player' }, amount: SNOW_GLOBE_BLOCK });
  }
  events.push(...drawCards(state, HAND_SIZE));
  return events;
}

/**
 * Out in the open, the weather's element falls into the cauldron at the start
 * of your turn (once more for each Sky Harvest). If the cauldron is full, it spills.
 */
function catchWeather(state: CombatState): CombatEvent[] {
  const element = WEATHER_ELEMENTS[state.weather.current];
  if (!element || !state.player.exposed) return [];
  const events: CombatEvent[] = [];
  const harvests = lastingCount(state, 'skyHarvest');
  if (harvests > 0) events.push({ type: 'lastingEffect', card: 'skyHarvest' });
  for (let i = 0; i <= harvests; i++) {
    if (state.cauldron.length >= state.cauldronSlots) {
      events.push({ type: 'spill', element });
      continue;
    }
    state.cauldron.push(element);
    events.push({ type: 'element', element, fromWeather: true });
    if (hasRelic(state, 'dewcatcher')) {
      gainBlock(state.player, DEWCATCHER_BLOCK);
      events.push({ type: 'relic', relic: 'dewcatcher' }, { type: 'block', target: { side: 'player' }, amount: DEWCATCHER_BLOCK });
    }
  }
  return events;
}

/**
 * Steps out into the weather or takes cover. Free, during your turn; the choice
 * you end your turn with decides whether the weather reaches you this round.
 */
export function toggleExposure(state: CombatState): CombatEvent[] {
  if (state.status !== 'playing' || !canTakeCover(state)) return [];
  state.player.exposed = !state.player.exposed;
  return [{ type: 'exposure', exposed: state.player.exposed }];
}

/** Draws cards, shuffling the discard pile into the draw pile when it runs out. */
export function drawCards(state: CombatState, count: number): CombatEvent[] {
  const events: CombatEvent[] = [];
  for (let i = 0; i < count && state.hand.length < MAX_HAND_SIZE; i++) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) break;
      const discard = state.discardPile;
      state.drawPile = withRng(state, (rng) => rng.shuffle(discard));
      state.discardPile = [];
      events.push({ type: 'shuffle' });
    }
    const card = state.drawPile.pop();
    if (card) state.hand.push(card);
  }
  return events;
}

/** Applies card or brew effects in order. `target` is the chosen enemy, if any. */
function applyEffects(state: CombatState, effects: readonly Effect[], target?: number): CombatEvent[] {
  const events: CombatEvent[] = [];
  const targets = (all?: boolean): number[] => {
    if (all) return state.enemies.flatMap((e, i) => (isAlive(e) ? [i] : []));
    if (target !== undefined && state.enemies[target] && isAlive(state.enemies[target])) return [target];
    // No target chosen (shouldn't happen when cardNeedsTarget is respected): use the first living enemy.
    const first = state.enemies.findIndex(isAlive);
    return first >= 0 ? [first] : [];
  };

  for (const effect of effects) {
    if (state.status !== 'playing') break;
    switch (effect.type) {
      case 'damage':
        for (const index of targets(effect.all)) {
          const enemy = state.enemies[index] as EnemyState;
          const amount = playerAttackDamage(state, effect.amount, effect.element);
          const { blocked, hpLost } = dealDamage(enemy, amount);
          events.push({ type: 'damage', target: { side: 'enemy', index }, amount: hpLost, blocked });
        }
        updateStatus(state);
        break;
      case 'applyStatus':
        for (const index of targets(effect.all)) {
          const enemy = state.enemies[index] as EnemyState;
          enemy.statuses[effect.status] = (enemy.statuses[effect.status] ?? 0) + effect.amount;
          events.push({ type: 'status', target: { side: 'enemy', index }, status: effect.status, amount: effect.amount });
        }
        break;
      case 'block':
        gainBlock(state.player, effect.amount);
        events.push({ type: 'block', target: { side: 'player' }, amount: effect.amount });
        break;
      case 'heal': {
        const healed = Math.min(effect.amount, state.player.maxHp - state.player.hp);
        state.player.hp += healed;
        events.push({ type: 'heal', amount: healed });
        break;
      }
      case 'energy':
        state.player.energy += effect.amount;
        break;
      case 'draw':
        events.push(...drawCards(state, effect.amount));
        break;
      case 'setWeather':
        events.push(...setWeather(state, effect.weather, 'player'));
        break;
      case 'swapForecast': {
        const next = state.weather.forecast[0];
        if (!next) break;
        state.weather.forecast[0] = state.weather.currentCard;
        events.push(...setWeather(state, skyWeather(next), 'player'));
        break;
      }
      case 'scatter':
        withRng(state, (rng) => scatterForecast(state.weather, rng));
        events.push({ type: 'forecast' });
        break;
      case 'advanceWeather': {
        const from = state.weather.current;
        const to = withRng(state, (rng) => advanceWeather(state.weather, rng, state.turn));
        events.push({ type: 'weather', from, to, cause: 'player' });
        if (from !== to) events.push(...weatherChanged(state));
        break;
      }
      case 'holdWeather':
        events.push(...setWeather(state, state.weather.current, 'player'));
        break;
      case 'addElement':
        events.push(...addElement(state, effect.element, target));
        break;
      case 'catchWeather': {
        const element = WEATHER_ELEMENTS[state.weather.current];
        if (element) events.push(...addElement(state, element, target));
        break;
      }
      case 'brew':
        events.push(...brew(state, target));
        break;
      case 'bottle':
        state.bottleNext += 1;
        break;
      case 'doubleBrew':
        state.doubleNext += 1;
        break;
      case 'boilOver': {
        const count = state.cauldron.length;
        state.cauldron = [];
        const [index] = targets(false);
        const enemy = index === undefined ? undefined : state.enemies[index];
        if (!enemy || index === undefined || count === 0) break;
        const { blocked, hpLost } = dealDamage(enemy, playerAttackDamage(state, effect.amount * count, undefined));
        events.push({ type: 'damage', target: { side: 'enemy', index }, amount: hpLost, blocked });
        updateStatus(state);
        break;
      }
      case 'steal':
        for (const index of targets(false)) {
          const enemy = state.enemies[index] as EnemyState;
          const element = enemy.cauldron.pop();
          if (!element) continue;
          const kept = state.cauldron.length < state.cauldronSlots;
          if (kept) state.cauldron.push(element);
          events.push({ type: 'pilfer', index, element, kept });
        }
        break;
      case 'spoil':
        for (const index of targets(false)) {
          const enemy = state.enemies[index] as EnemyState;
          enemy.spoiled = true;
          events.push({ type: 'spoiled', index });
        }
        break;
      case 'lasting':
        state.lasting[effect.card] = lastingCount(state, effect.card) + 1;
        events.push({ type: 'lasting', card: effect.card });
        break;
      case 'doubleBlock': {
        const block = state.player.block;
        if (block <= 0) break;
        gainBlock(state.player, block);
        events.push({ type: 'block', target: { side: 'player' }, amount: block });
        break;
      }
      case 'blockDamage':
        for (const index of targets(false)) {
          const enemy = state.enemies[index] as EnemyState;
          const { blocked, hpLost } = dealDamage(enemy, playerAttackDamage(state, state.player.block, undefined));
          events.push({ type: 'damage', target: { side: 'enemy', index }, amount: hpLost, blocked });
        }
        updateStatus(state);
        break;
    }
  }
  return events;
}

/** Adds an element to the cauldron. Adding to a full cauldron brews it first; a brew always uses at least one slot. */
function addElement(state: CombatState, element: ElementId, target?: number): CombatEvent[] {
  const events: CombatEvent[] = [];
  if (state.cauldron.length >= state.cauldronSlots) events.push(...brew(state, target));
  if (state.status !== 'playing') return events;
  state.cauldron.push(element);
  events.push({ type: 'element', element });
  return events;
}

/** Brews the cauldron: see findBrew for which recipe is made. Unused elements stay. */
function brew(state: CombatState, target?: number): CombatEvent[] {
  if (state.cauldron.length === 0 || state.status !== 'playing') return [];
  const result = findBrew(state.cauldron);
  const used = result.usedSlots.map((i) => state.cauldron[i] as ElementId);
  state.cauldron = state.cauldron.filter((_, i) => !result.usedSlots.includes(i));
  const events: CombatEvent[] = [];
  let recipe = result.recipe;
  // The Alembic turns a failed brew into a random basic one.
  if (recipe.id === SLUDGE.id && hasRelic(state, 'alembic')) {
    recipe = getRecipe(withRng(state, (rng) => rng.pick(BASIC_RECIPES)));
    events.push({ type: 'relic', relic: 'alembic' });
  }
  const event: CombatEvent = { type: 'brew', recipeId: recipe.id, used };
  events.unshift(event);
  recordBrewed(state, recipe.id);
  // Bottling keeps a real recipe for later; Sludge and full potion belts are used as normal.
  if (state.bottleNext > 0 && recipe.id !== SLUDGE.id && state.potions.length < potionCapacity(state.relics)) {
    state.bottleNext -= 1;
    state.potions.push(recipe.id);
    event.bottled = true;
    return [...events, ...afterBrew(state)];
  }
  events.push(...applyEffects(state, recipe.effects, target));
  // Catalyst: the brew works a second time.
  if (state.doubleNext > 0 && recipe.id !== SLUDGE.id) {
    state.doubleNext -= 1;
    events.push(...applyEffects(state, recipe.effects, target));
  }
  return [...events, ...afterBrew(state)];
}

/** What every brew of yours also does: Steady Hands gives Block, the Grand Grimoire draws a card. */
function afterBrew(state: CombatState): CombatEvent[] {
  if (state.status !== 'playing') return [];
  const events: CombatEvent[] = [];
  const hands = lastingCount(state, 'steadyHands');
  if (hands > 0) {
    const amount = STEADY_HANDS_BLOCK * hands;
    gainBlock(state.player, amount);
    events.push({ type: 'lastingEffect', card: 'steadyHands' }, { type: 'block', target: { side: 'player' }, amount });
  }
  if (hasRelic(state, 'grandGrimoire')) events.push({ type: 'relic', relic: 'grandGrimoire' }, ...drawCards(state, 1));
  return events;
}

/**
 * A brewing enemy adds its next element; when its cauldron is full it brews,
 * and the brew's effects are turned against the player.
 */
function enemyGatherAndBrew(state: CombatState, index: number): CombatEvent[] {
  const enemy = state.enemies[index];
  const def = enemy && getEnemy(enemy.defId).cauldron;
  if (!enemy || !def || !isAlive(enemy)) return [];
  const events: CombatEvent[] = [];
  const element = def.gathers[enemy.gatherIndex % Math.max(1, def.gathers.length)];
  if (element && enemy.cauldron.length < def.size) {
    enemy.cauldron.push(element);
    enemy.gatherIndex += 1;
    events.push({ type: 'enemyGather', index, element });
  }
  if (enemy.cauldron.length >= def.size) events.push(...enemyBrew(state, index));
  return events;
}

function enemyBrew(state: CombatState, index: number): CombatEvent[] {
  const enemy = state.enemies[index] as EnemyState;
  const result = enemy.spoiled ? { recipe: SLUDGE, usedSlots: enemy.cauldron.map((_, i) => i) } : findBrew(enemy.cauldron);
  const used = result.usedSlots.map((i) => enemy.cauldron[i] as ElementId);
  enemy.cauldron = enemy.cauldron.filter((_, i) => !result.usedSlots.includes(i));
  enemy.spoiled = false;
  recordBrewed(state, result.recipe.id);
  const events: CombatEvent[] = [{ type: 'enemyBrew', index, recipeId: result.recipe.id, used }];
  for (const effect of result.recipe.effects) {
    if (state.status !== 'playing') break;
    events.push(...applyEnemyBrewEffect(state, index, effect));
    updateStatus(state);
  }
  return events;
}

/** A brew from an enemy's side: attacks and debuffs hit the player; Block and healing go to the enemy. */
function applyEnemyBrewEffect(state: CombatState, index: number, effect: Effect): CombatEvent[] {
  const enemy = state.enemies[index] as EnemyState;
  switch (effect.type) {
    case 'damage': {
      const amount = enemyAttackDamage(enemy, { name: 'brew', damage: effect.amount, element: effect.element }, state.weather.current);
      const { blocked, hpLost } = dealDamage(state.player, amount);
      return [{ type: 'damage', target: { side: 'player' }, amount: hpLost, blocked }];
    }
    case 'applyStatus':
      state.player.statuses[effect.status] = (state.player.statuses[effect.status] ?? 0) + effect.amount;
      return [{ type: 'status', target: { side: 'player' }, status: effect.status, amount: effect.amount }];
    case 'block':
      gainBlock(enemy, effect.amount);
      return [{ type: 'block', target: { side: 'enemy', index }, amount: effect.amount }];
    case 'heal':
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + effect.amount);
      return [];
    case 'setWeather':
      return setWeather(state, effect.weather, 'enemy');
    default:
      // Drawing, energy and cauldron effects mean nothing for an enemy.
      return [];
  }
}

/** What an enemy will brew at the end of this turn, if its cauldron fills up. */
export function enemyBrewPreview(enemy: EnemyState): RecipeDef | null {
  const def = getEnemy(enemy.defId).cauldron;
  if (!def) return null;
  const next = def.gathers[enemy.gatherIndex % Math.max(1, def.gathers.length)];
  const contents = next && enemy.cauldron.length < def.size ? [...enemy.cauldron, next] : [...enemy.cauldron];
  if (contents.length < def.size) return null;
  return enemy.spoiled ? SLUDGE : findBrew(contents).recipe;
}

/** Remembers a brewed recipe so it can be distilled after the fight. */
function recordBrewed(state: CombatState, recipeId: string): void {
  if (recipeId !== SLUDGE.id && !state.brewed.includes(recipeId)) state.brewed.push(recipeId);
}

/** Whether using this potion needs an enemy chosen. */
export function potionNeedsTarget(state: CombatState, index: number): boolean {
  const id = state.potions[index];
  return id !== undefined && effectsNeedTarget(getRecipe(id).effects);
}

/** Drinks a potion: its brew's effects happen right away, for free. */
export function usePotion(state: CombatState, index: number, targetIndex?: number): PlayResult {
  if (state.status !== 'playing') return { ok: false, reason: t('err.fightOver') };
  const id = state.potions[index];
  if (id === undefined) return { ok: false, reason: t('err.noPotion') };
  let target: number | undefined;
  if (potionNeedsTarget(state, index)) {
    const enemy = targetIndex === undefined ? undefined : state.enemies[targetIndex];
    if (targetIndex === undefined || !enemy || !isAlive(enemy)) return { ok: false, reason: t('err.chooseEnemy') };
    target = targetIndex;
  }
  state.potions.splice(index, 1);
  const events: CombatEvent[] = [{ type: 'potion', recipeId: id }, ...applyEffects(state, getRecipe(id).effects, target)];
  updateStatus(state);
  return { ok: true, events };
}

/** Burn: lose that much HP (ignoring Block) at the end of your turn, then it goes down by 1. */
function tickBurn(state: CombatState, ref: UnitRef): CombatEvent[] {
  const unit = getUnit(state, ref);
  const burn = unit.statuses.burn ?? 0;
  if (burn <= 0 || !isAlive(unit)) return [];
  const hpLost = Math.min(unit.hp, burn);
  unit.hp -= hpLost;
  unit.statuses.burn = burn - 1;
  return [{ type: 'damage', target: ref, amount: hpLost, blocked: 0, source: 'burn' }];
}

export const THUNDER_DRUM_BOLTS = 2;

/** Storm lightning strikes a random unit out in the weather (the Thunder Drum: only enemies, twice). */
function stormBolt(state: CombatState): CombatEvent[] {
  const drum = hasRelic(state, 'thunderDrum');
  const events: CombatEvent[] = [];
  for (let bolt = 0; bolt < (drum ? THUNDER_DRUM_BOLTS : 1); bolt++) {
    const candidates = livingUnits(state, 'storm').filter((ref) => !drum || ref.side === 'enemy');
    if (candidates.length === 0 || state.status !== 'playing') break;
    const ref = withRng(state, (rng) => rng.pick(candidates));
    const { blocked, hpLost } = dealDamage(getUnit(state, ref), STORM_BOLT_DAMAGE);
    events.push({ type: 'damage', target: ref, amount: hpLost, blocked, source: 'lightning' });
    updateStatus(state);
  }
  return events;
}

/**
 * The units this weather's harm can reach: out in the open (the player, unless
 * under cover; enemies, unless sheltered) and not protected against it.
 */
function livingUnits(state: CombatState, weather: WeatherId): UnitRef[] {
  const refs: UnitRef[] = [];
  const playerProtected =
    !state.player.exposed ||
    (weather === 'storm' && hasRelic(state, 'lightningRod')) ||
    (weather === 'heatwave' && hasRelic(state, 'sunStone'));
  if (isAlive(state.player) && !playerProtected) refs.push({ side: 'player' });
  state.enemies.forEach((enemy, index) => {
    if (isAlive(enemy) && !isWeathered(enemy, weather) && !isSheltered(enemy)) refs.push({ side: 'enemy', index });
  });
  return refs;
}

export function isSheltered(enemy: EnemyState): boolean {
  return getEnemy(enemy.defId).sheltered ?? false;
}

export function getUnit(state: CombatState, ref: UnitRef): Combatant {
  if (ref.side === 'player') return state.player;
  const enemy = state.enemies[ref.index];
  if (!enemy) throw new Error(`No enemy at index ${ref.index}`);
  return enemy;
}

/** Runs fn with the combat's RNG and saves the RNG's new state. */
function withRng<T>(state: CombatState, fn: (rng: Rng) => T): T {
  const rng = Rng.fromState(state.rngState);
  const result = fn(rng);
  state.rngState = rng.getState();
  return result;
}

function updateStatus(state: CombatState): void {
  if (!isAlive(state.player)) state.status = 'lost';
  else if (state.enemies.every((e) => !isAlive(e))) state.status = 'won';
}
