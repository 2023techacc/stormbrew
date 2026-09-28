import { SLUDGE } from '../data/recipes';
import type { CombatEvent } from './types';

/**
 * The recipes the player has discovered. It is kept between runs, so knowledge
 * is the game's meta-progression. Plain data for saving.
 */
export interface Grimoire {
  discovered: string[];
}

export function createGrimoire(): Grimoire {
  return { discovered: [] };
}

/** Sludge is always known; everything else must be brewed once. */
export function isKnown(grimoire: Grimoire, recipeId: string): boolean {
  return recipeId === SLUDGE.id || grimoire.discovered.includes(recipeId);
}

/**
 * Records the recipes brewed in these events, by the player or by enemies
 * (watching an enemy brew teaches it too). Returns the newly discovered ones.
 */
export function discoverFrom(grimoire: Grimoire, events: readonly CombatEvent[]): string[] {
  const found: string[] = [];
  for (const event of events) {
    if ((event.type !== 'brew' && event.type !== 'enemyBrew') || isKnown(grimoire, event.recipeId)) continue;
    grimoire.discovered.push(event.recipeId);
    found.push(event.recipeId);
  }
  return found;
}
