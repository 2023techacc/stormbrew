import type { WeatherId } from '../core/types';

/**
 * Weather cards: the sky deck the forecast is drawn from. The basic cards
 * share their weather's id and last the standard number of turns.
 */
export interface SkyCardDef {
  id: string;
  name: string;
  weather: WeatherId;
  /** How many turns this weather lasts once it arrives. */
  turns: number;
  text: string;
}

/** How long a basic weather lasts (the game's weather interval, see core/weather.ts). */
export const STANDARD_TURNS = 3;
const LONG_TURNS = STANDARD_TURNS + 2;
const SHORT_TURNS = STANDARD_TURNS - 1;

const basic = (id: WeatherId, name: string, what: string): SkyCardDef => ({
  id,
  name,
  weather: id,
  turns: STANDARD_TURNS,
  text: `${what} for ${STANDARD_TURNS} turns.`,
});

export const SKY_CARDS: Record<string, SkyCardDef> = {
  clear: basic('clear', 'Clear', 'Clear skies'),
  rain: basic('rain', 'Rain', 'Rain'),
  storm: basic('storm', 'Storm', 'Storm'),
  heatwave: basic('heatwave', 'Heatwave', 'Heatwave'),
  snow: basic('snow', 'Snow', 'Snow'),
  monsoon: { id: 'monsoon', name: 'Monsoon', weather: 'rain', turns: LONG_TURNS, text: `Rain for ${LONG_TURNS} turns.` },
  squall: { id: 'squall', name: 'Squall', weather: 'storm', turns: SHORT_TURNS, text: `A short Storm: ${SHORT_TURNS} turns.` },
  heatDome: { id: 'heatDome', name: 'Heat Dome', weather: 'heatwave', turns: LONG_TURNS, text: `Heatwave for ${LONG_TURNS} turns.` },
  deepFreeze: { id: 'deepFreeze', name: 'Deep Freeze', weather: 'snow', turns: LONG_TURNS, text: `Snow for ${LONG_TURNS} turns.` },
  calm: { id: 'calm', name: 'Calm', weather: 'clear', turns: LONG_TURNS, text: `Clear skies for ${LONG_TURNS} turns.` },
};

/** Every run's sky starts with one of each basic weather. */
export const STARTING_SKY = ['clear', 'rain', 'storm', 'heatwave', 'snow'];

/** Weather cards that can be bought. */
export const SKY_POOL = ['monsoon', 'squall', 'heatDome', 'deepFreeze', 'calm', 'rain', 'storm', 'heatwave', 'snow'];

export function getSkyCard(id: string): SkyCardDef {
  const card = SKY_CARDS[id];
  if (!card) throw new Error(`Unknown sky card: ${id}`);
  return card;
}
