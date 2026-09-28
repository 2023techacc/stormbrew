import { REWARD_POOL, STARTER_DECK } from '../data/cards';
import { ENCOUNTERS } from '../data/enemies';
import { createCombat } from './combat';
import { Rng } from './rng';
import type { CombatEvent, CombatState } from './types';

export const PLAYER_MAX_HP = 75;
/** HP healed after each victory. */
export const VICTORY_HEAL = 8;
/** Fights won before encounters get harder. */
export const EASY_FIGHTS = 2;
export const REWARD_CHOICES = 3;

/**
 * A run: fights one after another. HP and the deck carry over between fights.
 * Plain data so it can be saved as JSON.
 */
export interface RunState {
  rngState: number;
  hp: number;
  maxHp: number;
  deck: string[];
  fightsWon: number;
}

export function createRun(seed: number): RunState {
  return {
    rngState: new Rng(seed).getState(),
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    deck: [...STARTER_DECK],
    fightsWon: 0,
  };
}

/** Starts the next fight: an easy encounter at first, harder ones later. */
export function startFight(run: RunState): { state: CombatState; events: CombatEvent[] } {
  const tier = run.fightsWon < EASY_FIGHTS ? ENCOUNTERS.easy : ENCOUNTERS.hard;
  const { enemies, seed } = withRng(run, (rng) => ({
    enemies: rng.pick(tier),
    seed: rng.int(0, 2 ** 32 - 1),
  }));
  return createCombat({ seed, deck: run.deck, enemies, playerHp: run.hp, playerMaxHp: run.maxHp });
}

/** Records a finished fight. Returns the HP healed (0 on a loss). */
export function finishFight(run: RunState, combat: CombatState): number {
  if (combat.status !== 'won') {
    run.hp = 0;
    return 0;
  }
  run.fightsWon += 1;
  const before = combat.player.hp;
  run.hp = Math.min(run.maxHp, before + VICTORY_HEAL);
  return run.hp - before;
}

/** Distinct cards to choose from after a victory. */
export function rewardChoices(run: RunState): string[] {
  return withRng(run, (rng) => rng.shuffle(REWARD_POOL).slice(0, REWARD_CHOICES));
}

export function addCardToDeck(run: RunState, cardId: string): void {
  run.deck.push(cardId);
}

function withRng<T>(run: RunState, fn: (rng: Rng) => T): T {
  const rng = Rng.fromState(run.rngState);
  const result = fn(rng);
  run.rngState = rng.getState();
  return result;
}
