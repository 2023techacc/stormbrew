import { RECIPES, SLUDGE } from '../data/recipes';
import type { Effect, ElementId, RecipeDef, WeatherId } from './types';

export const CAULDRON_SLOTS = 3;

/** The largest recipe, in elements. */
const MAX_RECIPE_SIZE = Math.max(...RECIPES.map((r) => r.elements.length));

/** Each weather adds its element to every brew (it doesn't take a slot). */
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
  /** The weather's free element, if the recipe used it. */
  weatherElement?: ElementId;
}

/**
 * Works out what brewing the cauldron makes right now:
 * - The weather's free element joins the brew and is tried first.
 * - The largest matching recipe wins; among equal sizes, the oldest elements are used first.
 * - Elements the recipe doesn't use stay in the cauldron.
 * - If nothing matches, everything in the cauldron becomes Sludge.
 */
export function findBrew(cauldron: readonly ElementId[], weather: WeatherId): BrewResult {
  const free = WEATHER_ELEMENTS[weather];
  const pool = free ? [free, ...cauldron] : [...cauldron];
  const offset = free ? 1 : 0;

  for (let size = Math.min(pool.length, MAX_RECIPE_SIZE); size >= 2; size--) {
    for (const combo of combinations(pool.length, size)) {
      const recipe = findRecipe(combo.map((i) => pool[i] as ElementId));
      if (!recipe) continue;
      const usesFree = free !== undefined && combo[0] === 0;
      const usedSlots = combo.filter((i) => i >= offset).map((i) => i - offset);
      // A brew must use at least one element from the cauldron.
      if (usedSlots.length === 0) continue;
      return usesFree ? { recipe, usedSlots, weatherElement: free } : { recipe, usedSlots };
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
  return effects.some((e) => (e.type === 'damage' || e.type === 'applyStatus') && !e.all);
}
