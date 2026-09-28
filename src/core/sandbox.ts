import { STARTER_DECK, getCard } from '../data/cards';
import { MAX_HAND_SIZE, createCombat, setWeather } from './combat';
import type { CombatEvent, CombatState, WeatherId } from './types';

/** Enemies you can fight in the sandbox, starting with the harmless dummy. */
export const SANDBOX_ENEMIES = ['trainingDummy', 'cinderImp', 'drizzleSlime', 'stormCaller', 'frostGolem'];

/** A practice fight with lots of HP, to try cards, weather and brews. */
export function createSandbox(enemy: string, seed: number): CombatState {
  return createCombat({ seed, deck: STARTER_DECK, enemies: [enemy], playerHp: 999, playerMaxHp: 999 }).state;
}

/**
 * Puts a new copy of any card into the hand (it joins the deck for this fight).
 * Returns false if the hand is full.
 */
export function sandboxAddCard(state: CombatState, cardId: string): boolean {
  getCard(cardId); // throws on unknown ids
  if (state.hand.length >= MAX_HAND_SIZE) return false;
  const all = [...state.drawPile, ...state.hand, ...state.discardPile];
  const uid = Math.max(-1, ...all.map((c) => c.uid)) + 1;
  state.hand.push({ uid, defId: cardId });
  return true;
}

export function sandboxSetWeather(state: CombatState, weather: WeatherId): CombatEvent[] {
  return setWeather(state, weather, 'player');
}

export function sandboxRefillEnergy(state: CombatState): void {
  state.player.energy = state.player.maxEnergy;
}
