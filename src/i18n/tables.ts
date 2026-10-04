/**
 * The shape of a language's game content: names and texts of cards, enemies,
 * relics and so on. English lives in src/data; every other language has one
 * of these (see ./content.ts), and a test checks that nothing is missing.
 *
 * `{damage}` in card and recipe texts is filled in when a card is drawn (with
 * weather and Weak applied), and `{turns}` in weather card texts with how long
 * the weather lasts.
 */
export interface NameText {
  name: string;
  text: string;
  /** A shorter text for a recipe's Flask card, when `text` is too long for a card. */
  cardText?: string;
}

export interface EventText {
  name: string;
  text: string;
  options: Record<string, { label: string; text: string }>;
}

export interface ContentTable {
  cards: Record<string, NameText>;
  recipes: Record<string, NameText>;
  enemies: Record<string, string>;
  /** Enemy moves, looked up by their English name. */
  moves: Record<string, string>;
  relics: Record<string, NameText>;
  /** Act names, by act number. */
  acts: Record<number, string>;
  /** Weather cards for the sky deck. */
  sky: Record<string, NameText>;
  events: Record<string, EventText>;
}
