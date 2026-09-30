import { RECIPES, SLUDGE } from '../data/recipes';
import type { Effect, ElementId, RecipeDef, WeatherId } from './types';

export const CAULDRON_SLOTS = 3;

/** The largest recipe, in elements. */
const MAX_RECIPE_SIZE = Math.max(...RECIPES.map((r) => r.elements.length));

/** The element each weather drops into the cauldron of a player standing out in it. */
export const WEATHER_ELEMENTS: Record<WeatherId, ElementId | undefined> = {
  clear: undefined,
  rain: 'water',
  storm: 'spark',
  heatwave: 'fire',
  snow: 'frost',
};

/** Order never matters: a recipe is identified by its sorted elements. */
export function recipeKey(elements: readonly ElementId[]): string {
  return [...elements].sort().join('+');
}

const RECIPES_BY_KEY = new Map(RECIPES.map((r) => [recipeKey(r.elements), r]));

export function findRecipe(elements: readonly ElementId[]): RecipeDef | undefined {
  return RECIPES_BY_KEY.get(recipeKey(elements));
}

export interface BrewResult {
  recipe: RecipeDef;
  /** Indices into the cauldron of the elements used up. */
  usedSlots: number[];
}

/**
 * Works out what brewing the cauldron makes right now:
 * - The largest matching recipe wins; among equal sizes, the oldest elements are used first.
 * - Elements the recipe doesn't use stay in the cauldron.
 * - If nothing matches, everything in the cauldron becomes Sludge.
 */
export function findBrew(cauldron: readonly ElementId[]): BrewResult {
  for (let size = Math.min(cauldron.length, MAX_RECIPE_SIZE); size >= 2; size--) {
    for (const usedSlots of combinations(cauldron.length, size)) {
      const recipe = findRecipe(usedSlots.map((i) => cauldron[i] as ElementId));
      if (recipe) return { recipe, usedSlots };
    }
  }
  return { recipe: SLUDGE, usedSlots: cauldron.map((_, i) => i) };
}

/** All ways to choose `size` indices from 0..n-1, in lexicographic order. */
function* combinations(n: number, size: number, start = 0, prefix: number[] = []): Generator<number[]> {
  if (prefix.length === size) {
    yield prefix;
    return;
  }
  for (let i = start; i < n; i++) yield* combinations(n, size, i + 1, [...prefix, i]);
}

/** Whether these effects need the player to choose an enemy. */
export function effectsNeedTarget(effects: readonly Effect[]): boolean {
  return effects.some(
    (e) =>
      ((e.type === 'damage' || e.type === 'applyStatus') && !e.all) ||
      e.type === 'steal' ||
      e.type === 'spoil' ||
      e.type === 'boilOver' ||
      e.type === 'blockDamage',
  );
}
