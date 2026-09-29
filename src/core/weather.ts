import type { Rng } from './rng';
import { STANDARD_TURNS, STARTING_SKY, getSkyCard } from '../data/sky';
import type { ElementId, WeatherId, WeatherState } from './types';

/**
 * Each weather lasts this many turns, then changes to the forecast. Changing the
 * weather with a card or enemy move restarts the countdown. It is the length of
 * a basic weather card, set in data/sky.ts.
 */
export const WEATHER_INTERVAL = STANDARD_TURNS;

/** How many upcoming weathers are generated ahead of time. */
export const FORECAST_LENGTH = 2;

export const STORM_BOLT_DAMAGE = 5;
export const HEATWAVE_BURN = 1;

export const WEATHER_IDS: readonly WeatherId[] = ['clear', 'rain', 'storm', 'heatwave', 'snow'];

export interface WeatherInfo {
  name: string;
  effect: string;
}

export const WEATHER_INFO: Record<WeatherId, WeatherInfo> = {
  clear: { name: 'Clear', effect: 'No effect.' },
  rain: { name: 'Rain', effect: 'Fire damage −25%.' },
  storm: {
    name: 'Storm',
    effect: `End of each round: lightning hits a random unit for ${STORM_BOLT_DAMAGE}.`,
  },
  heatwave: {
    name: 'Heatwave',
    effect: `Fire damage +25%. Everyone gains ${HEATWAVE_BURN} Burn each turn.`,
  },
  snow: { name: 'Snow', effect: 'Block does not wear off.' },
};

/** Turns left until the next change (1 = it changes next turn). */
export function turnsUntilChange(weather: WeatherState, turn: number): number {
  return weather.nextChangeTurn - turn;
}

export function isChangeDue(weather: WeatherState, turn: number): boolean {
  return turn >= weather.nextChangeTurn;
}

/** The weather a sky card brings. */
export function skyWeather(cardId: string): WeatherId {
  return getSkyCard(cardId).weather;
}

/**
 * The fight's first weather starts on turn 1; the forecast is drawn from the
 * sky deck. `start: 'sky'` draws the first weather from the sky too.
 */
export function createWeather(
  rng: Rng,
  start: WeatherId | 'sky' = 'clear',
  sky: readonly string[] = STARTING_SKY,
): WeatherState {
  const weather: WeatherState = {
    current: 'clear',
    currentCard: 'clear',
    forecast: [],
    nextChangeTurn: 1 + WEATHER_INTERVAL,
    skyPile: rng.shuffle(sky),
    skyDeck: [...sky],
  };
  if (start === 'sky') advanceWeather(weather, rng, 1);
  else {
    weather.current = start;
    weather.currentCard = start;
  }
  fillForecast(weather, rng);
  return weather;
}

/** Moves to the next forecast weather on `turn` for as many turns as its card lasts, and extends the forecast. */
export function advanceWeather(weather: WeatherState, rng: Rng, turn: number): WeatherId {
  const card = weather.forecast.shift() ?? drawSky(weather, rng, weather.current);
  weather.currentCard = card;
  weather.current = skyWeather(card);
  weather.nextChangeTurn = turn + getSkyCard(card).turns;
  fillForecast(weather, rng);
  return weather.current;
}

/**
 * Sets the weather outside the schedule. The new weather gets a full
 * WEATHER_INTERVAL of the player's turns, starting with `firstTurn`.
 * The forecast stays the same, except that a forecast of the weather that is
 * now current is skipped, since the next change should change something.
 */
export function overrideWeather(
  weather: WeatherState,
  rng: Rng,
  to: WeatherId,
  firstTurn: number,
): void {
  weather.current = to;
  weather.currentCard = to;
  weather.nextChangeTurn = firstTurn + WEATHER_INTERVAL;
  while (weather.forecast[0] !== undefined && skyWeather(weather.forecast[0]) === to) weather.forecast.shift();
  fillForecast(weather, rng);
}

/** Replaces the next forecast weather with a new card from the sky. */
export function scatterForecast(weather: WeatherState, rng: Rng): void {
  weather.forecast.shift();
  fillForecast(weather, rng);
}

/** Shuffles extra sky cards (e.g. from an enemy) into this fight's sky pile. */
export function addToSky(weather: WeatherState, rng: Rng, cards: readonly string[]): void {
  for (const card of cards) {
    getSkyCard(card); // throws on unknown ids
    weather.skyDeck.push(card);
    weather.skyPile.splice(rng.int(0, weather.skyPile.length), 0, card);
  }
}

function fillForecast(weather: WeatherState, rng: Rng): void {
  while (weather.forecast.length < FORECAST_LENGTH) {
    const last = weather.forecast[weather.forecast.length - 1];
    weather.forecast.push(drawSky(weather, rng, last === undefined ? weather.current : skyWeather(last)));
  }
}

/**
 * Draws the next sky card, reshuffling the sky deck when the pile is empty.
 * A change should change something, so a card with the previous weather goes
 * to the bottom of the pile (unless the whole sky is that weather).
 */
function drawSky(weather: WeatherState, rng: Rng, previous: WeatherId): string {
  if (weather.skyPile.length === 0) weather.skyPile = rng.shuffle(weather.skyDeck);
  const differs = (card: string) => skyWeather(card) !== previous;
  // Only the previous weather is left in the pile, but the sky has others: start a fresh shuffle.
  if (!weather.skyPile.some(differs) && weather.skyDeck.some(differs)) weather.skyPile = rng.shuffle(weather.skyDeck);
  for (let tries = 0; tries < weather.skyPile.length; tries++) {
    const card = weather.skyPile.pop() as string;
    if (differs(card)) return card;
    weather.skyPile.unshift(card);
  }
  const fallback = weather.skyPile.pop();
  if (fallback !== undefined) return fallback;
  // An empty sky deck can only happen with bad data; fall back to any other weather.
  return rng.pick(WEATHER_IDS.filter((w) => w !== previous));
}

/** Applies the weather's modifier to outgoing damage. */
export function modifyDamage(amount: number, element: ElementId | undefined, weather: WeatherId): number {
  if (element === 'fire') {
    if (weather === 'rain') return Math.floor(amount * 0.75);
    if (weather === 'heatwave') return Math.floor(amount * 1.25);
  }
  return amount;
}

export function blockPersists(weather: WeatherId): boolean {
  return weather === 'snow';
}
