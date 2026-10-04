import type { CardDef, ElementId, WeatherId } from '../core/types';
import { HEATWAVE_BURN, STORM_BOLT_DAMAGE } from '../core/weather';
import { ELEMENT_ICONS, distilledKind, distilledRecipe } from '../data/distilled';
import { getAct } from '../data/acts';
import { getEnemy } from '../data/enemies';
import { getEvent } from '../data/events';
import { getRecipe } from '../data/recipes';
import { getRelic } from '../data/relics';
import { getSkyCard } from '../data/sky';
import { ES_CONTENT } from './es-content';
import { format, getLanguage, t, type Lang } from './index';
import { JA_CONTENT } from './ja-content';
import { KO_CONTENT } from './ko-content';
import type { ContentTable } from './tables';
import { ZH_CONTENT } from './zh-content';

/**
 * Names and texts of game content in the current language. English comes
 * from src/data; every other language has a content table, and anything
 * missing from it falls back to English (a test makes sure nothing is).
 */
export const CONTENT: Partial<Record<Lang, ContentTable>> = {
  ko: KO_CONTENT,
  ja: JA_CONTENT,
  zh: ZH_CONTENT,
  es: ES_CONTENT,
};

const table = (): ContentTable | undefined => CONTENT[getLanguage()];

export function recipeName(id: string): string {
  return table()?.recipes[id]?.name || getRecipe(id).name;
}

/** A recipe's rules text (`{damage}` is filled in by the card renderer). */
export function recipeText(id: string): string {
  return table()?.recipes[id]?.text || getRecipe(id).text;
}

/** The text on a recipe's Flask card: a long recipe text can have a shorter version for cards. */
function recipeCardText(id: string): string {
  const recipe = table()?.recipes[id] ?? getRecipe(id);
  return recipe.cardText ?? recipe.text;
}

export function cardName(def: CardDef): string {
  const recipe = distilledRecipe(def.id);
  if (recipe) {
    return t(distilledKind(def.id) === 'flask' ? 'distilled.flask' : 'distilled.essence', { recipe: recipeName(recipe) });
  }
  return table()?.cards[def.id]?.name || def.name;
}

/** A card's rules text (`{damage}` is filled in by the card renderer). */
export function cardText(def: CardDef): string {
  const recipe = distilledRecipe(def.id);
  if (recipe && distilledKind(def.id) === 'flask') return recipeCardText(recipe);
  if (recipe) return t('distilled.essenceText', { icons: getRecipe(recipe).elements.map((e) => ELEMENT_ICONS[e]).join('') });
  return table()?.cards[def.id]?.text || def.text;
}

export function enemyName(id: string): string {
  return table()?.enemies[id] || getEnemy(id).name;
}

/** An enemy move's name (moves are looked up by their English name). */
export function moveName(name: string): string {
  return table()?.moves[name] || name;
}

/** An act's name, e.g. "The Frostpeaks". */
export function actName(act: number): string {
  return table()?.acts[act] || getAct(act).name;
}

export function relicName(id: string): string {
  return table()?.relics[id]?.name || getRelic(id).name;
}

export function relicText(id: string): string {
  return table()?.relics[id]?.text || getRelic(id).text;
}

export function skyName(id: string): string {
  return table()?.sky[id]?.name || getSkyCard(id).name;
}

export function skyText(id: string): string {
  const own = table()?.sky[id];
  return own ? format(own.text, { turns: getSkyCard(id).turns }) : getSkyCard(id).text;
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
  return table()?.events[id]?.name || getEvent(id).name;
}

export function eventText(id: string): string {
  return table()?.events[id]?.text || getEvent(id).text;
}

function option(eventId: string, optionId: string) {
  const found = getEvent(eventId).options.find((o) => o.id === optionId);
  if (!found) throw new Error(`Unknown option ${optionId} of ${eventId}`);
  return found;
}

export function optionLabel(eventId: string, optionId: string): string {
  return table()?.events[eventId]?.options[optionId]?.label || option(eventId, optionId).label;
}

export function optionText(eventId: string, optionId: string): string {
  return table()?.events[eventId]?.options[optionId]?.text || option(eventId, optionId).text;
}
