import type { Rng } from './rng';
import type { ElementId, WeatherId, WeatherState } from './types';

/** The weather changes on a fixed schedule: every this many turns. */
export const WEATHER_INTERVAL = 3;

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

/** Weather changes at the start of turns 1 + N, 1 + 2N, ... */
export function isScheduledChangeTurn(turn: number): boolean {
  return turn > 1 && (turn - 1) % WEATHER_INTERVAL === 0;
}

/** Turns left until the next scheduled change (1 = it changes next turn). */
export function turnsUntilChange(turn: number): number {
  return WEATHER_INTERVAL - ((turn - 1) % WEATHER_INTERVAL);
}

export function createWeather(rng: Rng, start: WeatherId = 'clear'): WeatherState {
  const weather: WeatherState = { current: start, forecast: [] };
  fillForecast(weather, rng);
  return weather;
}

/** Moves to the next forecast weather and extends the forecast. */
export function advanceWeather(weather: WeatherState, rng: Rng): WeatherId {
  const next = weather.forecast.shift() ?? pickNext(rng, weather.current);
  weather.current = next;
  fillForecast(weather, rng);
  return next;
}

function fillForecast(weather: WeatherState, rng: Rng): void {
  while (weather.forecast.length < FORECAST_LENGTH) {
    const last = weather.forecast[weather.forecast.length - 1] ?? weather.current;
    weather.forecast.push(pickNext(rng, last));
  }
}

/** A scheduled change always changes something, so never repeat the previous weather. */
function pickNext(rng: Rng, previous: WeatherId): WeatherId {
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
