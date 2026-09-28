import { getCard } from '../data/cards';
import { getEnemy } from '../data/enemies';
import { CAULDRON_SLOTS, effectsNeedTarget, findBrew, type BrewResult } from './brewing';
import { dealDamage, gainBlock } from './effects';
import { Rng } from './rng';
import type {
  CardDef,
  CardInstance,
  Effect,
  CombatEvent,
  CombatState,
  Combatant,
  EnemyMove,
  ElementId,
  EnemyState,
  UnitRef,
  WeatherId,
} from './types';
import {
  HEATWAVE_BURN,
  STORM_BOLT_DAMAGE,
  advanceWeather,
  blockPersists,
  createWeather,
  isChangeDue,
  modifyDamage,
  overrideWeather,
} from './weather';

export const HAND_SIZE = 5;
export const MAX_HAND_SIZE = 10;
export const PLAYER_MAX_ENERGY = 3;
/** Weak units deal this much less attack damage. */
export const WEAK_MULTIPLIER = 0.75;

export interface CombatSetup {
  seed: number;
  deck: string[];
  enemies: string[];
  playerHp: number;
  playerMaxHp: number;
  startWeather?: WeatherId;
}

export type PlayResult = { ok: true; events: CombatEvent[] } | { ok: false; reason: string };

/** Creates a fight and starts the player's first turn. */
export function createCombat(setup: CombatSetup): { state: CombatState; events: CombatEvent[] } {
  const rng = new Rng(setup.seed);
  const deck: CardInstance[] = setup.deck.map((defId, uid) => ({ uid, defId }));
  const state: CombatState = {
    player: {
      hp: setup.playerHp,
      maxHp: setup.playerMaxHp,
      block: 0,
      statuses: {},
      energy: 0,
      maxEnergy: PLAYER_MAX_ENERGY,
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
      };
    }),
    drawPile: rng.shuffle(deck),
    hand: [],
    discardPile: [],
    turn: 0,
    weather: createWeather(rng, setup.startWeather),
    cauldron: [],
    status: 'playing',
    rngState: rng.getState(),
  };
  return { state, events: startPlayerTurn(state) };
}

/** The move an enemy will make at the end of this turn (its intent). */
export function currentIntent(enemy: EnemyState): EnemyMove {
  const moves = getEnemy(enemy.defId).moves;
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
  if (state.status !== 'playing') return 'The fight is over.';
  if (!state.hand.some((c) => c.uid === card.uid)) return 'That card is not in your hand.';
  const def = getCard(card.defId);
  if (def.cost > state.player.energy) return 'Not enough energy.';
  if (brewsFromCauldronOnly(def) && state.cauldron.length === 0) return 'The cauldron is empty.';
  return null;
}

/** A card like Stir that brews without adding anything first. */
function brewsFromCauldronOnly(def: CardDef): boolean {
  const firstCauldronEffect = def.effects.find((e) => e.type === 'brew' || e.type === 'addElement');
  return firstCauldronEffect?.type === 'brew';
}

/**
 * What playing this card would brew (the first brew it triggers), or null if it
 * doesn't brew. Used for previews and to decide whether the card needs a target.
 */
export function previewCardBrew(state: CombatState, def: CardDef): BrewResult | null {
  const cauldron = [...state.cauldron];
  let weather = state.weather.current;
  for (const effect of def.effects) {
    if (effect.type === 'setWeather') weather = effect.weather;
    if (effect.type === 'addElement') {
      // A full cauldron brews first to make room.
      if (cauldron.length >= CAULDRON_SLOTS) return findBrew(cauldron, weather);
      cauldron.push(effect.element);
    }
    if (effect.type === 'brew') return cauldron.length > 0 ? findBrew(cauldron, weather) : null;
  }
  return null;
}

/** Whether playing this card needs an enemy chosen (for itself or the brew it triggers). */
export function cardNeedsTarget(state: CombatState, card: CardInstance): boolean {
  const def = getCard(card.defId);
  if (def.target === 'enemy') return true;
  const brew = previewCardBrew(state, def);
  return brew !== null && effectsNeedTarget(brew.recipe.effects);
}

export function playCard(state: CombatState, uid: number, targetIndex?: number): PlayResult {
  const card = state.hand.find((c) => c.uid === uid);
  if (!card) return { ok: false, reason: 'That card is not in your hand.' };
  const reason = cannotPlayReason(state, card);
  if (reason) return { ok: false, reason };

  const def = getCard(card.defId);
  let target: number | undefined;
  if (cardNeedsTarget(state, card)) {
    const enemy = targetIndex === undefined ? undefined : state.enemies[targetIndex];
    if (targetIndex === undefined || !enemy || !isAlive(enemy)) {
      return { ok: false, reason: 'Choose an enemy.' };
    }
    target = targetIndex;
  }

  state.player.energy -= def.cost;
  state.hand = state.hand.filter((c) => c.uid !== uid);
  const events = applyEffects(state, def.effects, target);
  // Discard after resolving, so a card that draws can't draw itself.
  state.discardPile.push(card);
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
  events.push(...tickBurn(state, { side: 'player' }));
  updateStatus(state);

  state.enemies.forEach((enemy, index) => {
    if (!isAlive(enemy) || state.status !== 'playing') return;
    // Like the player, an enemy's Block wears off when its own turn starts.
    if (!blockPersists(state.weather.current)) enemy.block = 0;
    const move = currentIntent(enemy);
    events.push({ type: 'enemyMove', index, move });
    if (move.weather) events.push(...setWeather(state, move.weather, 'enemy'));
    if (move.block) {
      gainBlock(enemy, move.block);
      events.push({ type: 'block', target: { side: 'enemy', index }, amount: move.block });
    }
    if (move.damage) {
      const amount = enemyAttackDamage(enemy, move, state.weather.current);
      const { blocked, hpLost } = dealDamage(state.player, amount);
      events.push({ type: 'damage', target: { side: 'player' }, amount: hpLost, blocked });
    }
    enemy.moveIndex += 1;
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

/** How much an enemy's attack will hit for: weather first, then Weak. */
export function enemyAttackDamage(enemy: EnemyState, move: EnemyMove, weather: WeatherId): number {
  const amount = modifyDamage(move.damage ?? 0, move.element, weather);
  return enemy.statuses.weak ? Math.floor(amount * WEAK_MULTIPLIER) : amount;
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
  return [{ type: 'weather', from, to: weather, cause }];
}

function startPlayerTurn(state: CombatState): CombatEvent[] {
  const events: CombatEvent[] = [];
  state.turn += 1;

  if (isChangeDue(state.weather, state.turn)) {
    const from = state.weather.current;
    const to = withRng(state, (rng) => advanceWeather(state.weather, rng, state.turn));
    if (from !== to) events.push({ type: 'weather', from, to, cause: 'schedule' });
  }

  if (!blockPersists(state.weather.current)) state.player.block = 0;

  if (state.weather.current === 'heatwave') {
    for (const ref of livingUnits(state, 'heatwave')) {
      const unit = getUnit(state, ref);
      unit.statuses.burn = (unit.statuses.burn ?? 0) + HEATWAVE_BURN;
      events.push({ type: 'status', target: ref, status: 'burn', amount: HEATWAVE_BURN });
    }
  }

  state.player.energy = state.player.maxEnergy;
  events.push(...drawCards(state, HAND_SIZE));
  return events;
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
          const amount = modifyDamage(effect.amount, effect.element, state.weather.current);
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
      case 'addElement':
        // Adding to a full cauldron brews it first; a brew always uses at least one slot.
        if (state.cauldron.length >= CAULDRON_SLOTS) events.push(...brew(state, target));
        if (state.status !== 'playing') break;
        state.cauldron.push(effect.element);
        events.push({ type: 'element', element: effect.element });
        break;
      case 'brew':
        events.push(...brew(state, target));
        break;
    }
  }
  return events;
}

/** Brews the cauldron: see findBrew for which recipe is made. Unused elements stay. */
function brew(state: CombatState, target?: number): CombatEvent[] {
  if (state.cauldron.length === 0 || state.status !== 'playing') return [];
  const result = findBrew(state.cauldron, state.weather.current);
  const used = result.usedSlots.map((i) => state.cauldron[i] as ElementId);
  state.cauldron = state.cauldron.filter((_, i) => !result.usedSlots.includes(i));
  const event: CombatEvent = { type: 'brew', recipeId: result.recipe.id, used };
  if (result.weatherElement) event.weatherElement = result.weatherElement;
  return [event, ...applyEffects(state, result.recipe.effects, target)];
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

function stormBolt(state: CombatState): CombatEvent[] {
  const candidates = livingUnits(state, 'storm');
  if (candidates.length === 0) return [];
  const ref = withRng(state, (rng) => rng.pick(candidates));
  const { blocked, hpLost } = dealDamage(getUnit(state, ref), STORM_BOLT_DAMAGE);
  return [{ type: 'damage', target: ref, amount: hpLost, blocked, source: 'lightning' }];
}

/** The player and every living enemy that isn't Weathered against this weather. */
function livingUnits(state: CombatState, weather: WeatherId): UnitRef[] {
  const refs: UnitRef[] = [];
  if (isAlive(state.player)) refs.push({ side: 'player' });
  state.enemies.forEach((enemy, index) => {
    if (isAlive(enemy) && !isWeathered(enemy, weather)) refs.push({ side: 'enemy', index });
  });
  return refs;
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
