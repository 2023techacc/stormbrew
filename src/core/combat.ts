import { getCard } from '../data/cards';
import { getEnemy } from '../data/enemies';
import { dealDamage, gainBlock } from './effects';
import { Rng } from './rng';
import type {
  CardDef,
  CardInstance,
  CombatEvent,
  CombatState,
  Combatant,
  EnemyMove,
  EnemyState,
  UnitRef,
} from './types';

export const HAND_SIZE = 5;
export const MAX_HAND_SIZE = 10;
export const PLAYER_MAX_ENERGY = 3;

export interface CombatSetup {
  seed: number;
  deck: string[];
  enemies: string[];
  playerHp: number;
  playerMaxHp: number;
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
      energy: 0,
      maxEnergy: PLAYER_MAX_ENERGY,
    },
    enemies: setup.enemies.map((id) => {
      const def = getEnemy(id);
      return { defId: id, name: def.name, hp: def.maxHp, maxHp: def.maxHp, block: 0, moveIndex: 0 };
    }),
    drawPile: rng.shuffle(deck),
    hand: [],
    discardPile: [],
    turn: 0,
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

/** Why a card can't be played right now, or null if it can. */
export function cannotPlayReason(state: CombatState, card: CardInstance): string | null {
  if (state.status !== 'playing') return 'The fight is over.';
  if (!state.hand.some((c) => c.uid === card.uid)) return 'That card is not in your hand.';
  if (getCard(card.defId).cost > state.player.energy) return 'Not enough energy.';
  return null;
}

export function playCard(state: CombatState, uid: number, targetIndex?: number): PlayResult {
  const card = state.hand.find((c) => c.uid === uid);
  if (!card) return { ok: false, reason: 'That card is not in your hand.' };
  const reason = cannotPlayReason(state, card);
  if (reason) return { ok: false, reason };

  const def = getCard(card.defId);
  let target: UnitRef = { side: 'player' };
  if (def.target === 'enemy') {
    const enemy = targetIndex === undefined ? undefined : state.enemies[targetIndex];
    if (targetIndex === undefined || !enemy || !isAlive(enemy)) {
      return { ok: false, reason: 'Choose an enemy.' };
    }
    target = { side: 'enemy', index: targetIndex };
  }

  state.player.energy -= def.cost;
  state.hand = state.hand.filter((c) => c.uid !== uid);
  state.discardPile.push(card);

  const events = applyCardEffects(state, def, target);
  updateStatus(state);
  return { ok: true, events };
}

/** Ends the player's turn: discard the hand, enemies act, then the next turn starts. */
export function endTurn(state: CombatState): CombatEvent[] {
  if (state.status !== 'playing') return [];
  const events: CombatEvent[] = [];

  state.discardPile.push(...state.hand);
  state.hand = [];

  state.enemies.forEach((enemy, index) => {
    if (!isAlive(enemy) || state.status !== 'playing') return;
    // Like the player, an enemy's Block wears off when its own turn starts.
    enemy.block = 0;
    const move = currentIntent(enemy);
    events.push({ type: 'enemyMove', index, move });
    if (move.block) {
      gainBlock(enemy, move.block);
      events.push({ type: 'block', target: { side: 'enemy', index }, amount: move.block });
    }
    if (move.damage) {
      const { blocked, hpLost } = dealDamage(state.player, move.damage);
      events.push({ type: 'damage', target: { side: 'player' }, amount: hpLost, blocked });
    }
    enemy.moveIndex += 1;
    updateStatus(state);
  });

  if (state.status === 'playing') events.push(...startPlayerTurn(state));
  return events;
}

function startPlayerTurn(state: CombatState): CombatEvent[] {
  state.turn += 1;
  state.player.block = 0;
  state.player.energy = state.player.maxEnergy;
  return drawCards(state, HAND_SIZE);
}

/** Draws cards, shuffling the discard pile into the draw pile when it runs out. */
export function drawCards(state: CombatState, count: number): CombatEvent[] {
  const events: CombatEvent[] = [];
  for (let i = 0; i < count && state.hand.length < MAX_HAND_SIZE; i++) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) break;
      const rng = Rng.fromState(state.rngState);
      state.drawPile = rng.shuffle(state.discardPile);
      state.discardPile = [];
      state.rngState = rng.getState();
      events.push({ type: 'shuffle' });
    }
    const card = state.drawPile.pop();
    if (card) state.hand.push(card);
  }
  return events;
}

function applyCardEffects(state: CombatState, def: CardDef, target: UnitRef): CombatEvent[] {
  const events: CombatEvent[] = [];
  for (const effect of def.effects) {
    switch (effect.type) {
      case 'damage': {
        if (target.side !== 'enemy') break;
        const enemy = state.enemies[target.index];
        if (!enemy) break;
        const { blocked, hpLost } = dealDamage(enemy, effect.amount);
        events.push({ type: 'damage', target, amount: hpLost, blocked });
        break;
      }
      case 'block':
        gainBlock(state.player, effect.amount);
        events.push({ type: 'block', target: { side: 'player' }, amount: effect.amount });
        break;
    }
  }
  return events;
}

function updateStatus(state: CombatState): void {
  if (!isAlive(state.player)) state.status = 'lost';
  else if (state.enemies.every((e) => !isAlive(e))) state.status = 'won';
}
