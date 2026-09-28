import { effectsNeedTarget } from '../core/brewing';
import type { CardDef, ElementId, RecipeDef } from '../core/types';
import { RECIPES } from './recipes';

/**
 * Distilled cards: every recipe can become two cards after you brew it.
 * - A Flask is the brew itself as a card.
 * - An Essence adds the recipe's elements straight into the cauldron.
 * They are generated from the recipes, so each new recipe adds two cards.
 */
const FLASK = 'flask-';
const ESSENCE = 'essence-';

const ELEMENT_ICONS: Record<ElementId, string> = {
  fire: '🔥',
  water: '💧',
  earth: '🪨',
  air: '🌬️',
  spark: '⚡',
  frost: '❄️',
};

/** Two-element recipes cost 1, three-element ones 2. */
const distilledCost = (recipe: RecipeDef) => recipe.elements.length - 1;

export function flaskId(recipeId: string): string {
  return FLASK + recipeId;
}

export function essenceId(recipeId: string): string {
  return ESSENCE + recipeId;
}

function flaskCard(recipe: RecipeDef): CardDef {
  return {
    id: flaskId(recipe.id),
    name: `${recipe.name} Flask`,
    cost: distilledCost(recipe),
    kind: recipe.effects.some((e) => e.type === 'damage') ? 'attack' : 'skill',
    target: effectsNeedTarget(recipe.effects) ? 'enemy' : 'self',
    effects: recipe.effects,
    text: recipe.cardText ?? recipe.text,
  };
}

function essenceCard(recipe: RecipeDef): CardDef {
  return {
    id: essenceId(recipe.id),
    name: `${recipe.name} Essence`,
    cost: distilledCost(recipe),
    kind: 'skill',
    target: 'self',
    effects: recipe.elements.map((element) => ({ type: 'addElement', element })),
    text: `Add ${recipe.elements.map((e) => ELEMENT_ICONS[e]).join('')}.`,
  };
}

export const DISTILLED_CARDS: Record<string, CardDef> = Object.fromEntries(
  RECIPES.flatMap((r) => [flaskCard(r), essenceCard(r)]).map((card) => [card.id, card]),
);

/** The recipe a distilled card came from, or undefined for other cards. */
export function distilledRecipe(cardId: string): string | undefined {
  if (cardId.startsWith(FLASK)) return cardId.slice(FLASK.length);
  if (cardId.startsWith(ESSENCE)) return cardId.slice(ESSENCE.length);
  return undefined;
}
