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

const STANDARD_TURNS = 3;

export const SKY_CARDS: Record<string, SkyCardDef> = {
  clear: { id: 'clear', name: 'Clear', weather: 'clear', turns: STANDARD_TURNS, text: 'Clear skies for 3 turns.' },
  rain: { id: 'rain', name: 'Rain', weather: 'rain', turns: STANDARD_TURNS, text: 'Rain for 3 turns.' },
  storm: { id: 'storm', name: 'Storm', weather: 'storm', turns: STANDARD_TURNS, text: 'Storm for 3 turns.' },
  heatwave: { id: 'heatwave', name: 'Heatwave', weather: 'heatwave', turns: STANDARD_TURNS, text: 'Heatwave for 3 turns.' },
  snow: { id: 'snow', name: 'Snow', weather: 'snow', turns: STANDARD_TURNS, text: 'Snow for 3 turns.' },
  monsoon: { id: 'monsoon', name: 'Monsoon', weather: 'rain', turns: 5, text: 'Rain for 5 turns.' },
  squall: { id: 'squall', name: 'Squall', weather: 'storm', turns: 2, text: 'A short Storm: 2 turns.' },
  heatDome: { id: 'heatDome', name: 'Heat Dome', weather: 'heatwave', turns: 5, text: 'Heatwave for 5 turns.' },
  deepFreeze: { id: 'deepFreeze', name: 'Deep Freeze', weather: 'snow', turns: 5, text: 'Snow for 5 turns.' },
  calm: { id: 'calm', name: 'Calm', weather: 'clear', turns: 5, text: 'Clear skies for 5 turns.' },
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
