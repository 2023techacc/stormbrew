import type { CardDef, ElementId, WeatherId } from '../core/types';
import { HEATWAVE_BURN, STORM_BOLT_DAMAGE } from '../core/weather';
import { ELEMENT_ICONS, distilledKind, distilledRecipe } from '../data/distilled';
import { getAct } from '../data/acts';
import { getEnemy } from '../data/enemies';
import { getEvent } from '../data/events';
import { getRecipe } from '../data/recipes';
import { getRelic } from '../data/relics';
import { getSkyCard } from '../data/sky';
import { format, getLanguage, t } from './index';
import { KO_ACTS, KO_CARDS, KO_ENEMIES, KO_EVENTS, KO_MOVES, KO_RECIPES, KO_RELICS, KO_SKY } from './ko-content';

/**
 * Names and texts of game content in the current language. English comes
 * from src/data; other languages have their own tables, and anything missing
 * falls back to English.
 */
const korean = () => getLanguage() === 'ko';

export function recipeName(id: string): string {
  return (korean() && KO_RECIPES[id]?.name) || getRecipe(id).name;
}

/** A recipe's rules text (`{damage}` is filled in by the card renderer). */
export function recipeText(id: string): string {
  return (korean() && KO_RECIPES[id]?.text) || getRecipe(id).text;
}

/** The text on a recipe's Flask card: English has shorter card texts for long recipes. */
function recipeCardText(id: string): string {
  if (korean() && KO_RECIPES[id]) return KO_RECIPES[id].text;
  const recipe = getRecipe(id);
  return recipe.cardText ?? recipe.text;
}

export function cardName(def: CardDef): string {
  const recipe = distilledRecipe(def.id);
  if (recipe) {
    return t(distilledKind(def.id) === 'flask' ? 'distilled.flask' : 'distilled.essence', { recipe: recipeName(recipe) });
  }
  return (korean() && KO_CARDS[def.id]?.name) || def.name;
}

/** A card's rules text (`{damage}` is filled in by the card renderer). */
export function cardText(def: CardDef): string {
  const recipe = distilledRecipe(def.id);
  if (recipe && distilledKind(def.id) === 'flask') return recipeCardText(recipe);
  if (recipe) return t('distilled.essenceText', { icons: getRecipe(recipe).elements.map((e) => ELEMENT_ICONS[e]).join('') });
  return (korean() && KO_CARDS[def.id]?.text) || def.text;
}

export function enemyName(id: string): string {
  return (korean() && KO_ENEMIES[id]) || getEnemy(id).name;
}

/** An enemy move's name (moves are looked up by their English name). */
export function moveName(name: string): string {
  return (korean() && KO_MOVES[name]) || name;
}

/** An act's name, e.g. "The Frostpeaks". */
export function actName(act: number): string {
  return (korean() && KO_ACTS[act]) || getAct(act).name;
}

export function relicName(id: string): string {
  return (korean() && KO_RELICS[id]?.name) || getRelic(id).name;
}

export function relicText(id: string): string {
  return (korean() && KO_RELICS[id]?.text) || getRelic(id).text;
}

export function skyName(id: string): string {
  return (korean() && KO_SKY[id]?.name) || getSkyCard(id).name;
}

export function skyText(id: string): string {
  const ko = korean() && KO_SKY[id];
  return ko ? format(ko.text, { turns: getSkyCard(id).turns }) : getSkyCard(id).text;
}

export function weatherName(weather: WeatherId): string {
  return t(`weather.${weather}`);
}

export function weatherEffect(weather: WeatherId): string {
  return t(`weather.${weather}.effect`, { bolt: STORM_BOLT_DAMAGE, burn: HEATWAVE_BURN });
}

export function elementName(element: ElementId): string {
  return t(`element.${element}`);
}

export function eventName(id: string): string {
  return (korean() && KO_EVENTS[id]?.name) || getEvent(id).name;
}

export function eventText(id: string): string {
  return (korean() && KO_EVENTS[id]?.text) || getEvent(id).text;
}

function option(eventId: string, optionId: string) {
  const found = getEvent(eventId).options.find((o) => o.id === optionId);
  if (!found) throw new Error(`Unknown option ${optionId} of ${eventId}`);
  return found;
}

export function optionLabel(eventId: string, optionId: string): string {
  return (korean() && KO_EVENTS[eventId]?.options[optionId]?.label) || option(eventId, optionId).label;
}

export function optionText(eventId: string, optionId: string): string {
  return (korean() && KO_EVENTS[eventId]?.options[optionId]?.text) || option(eventId, optionId).text;
}
