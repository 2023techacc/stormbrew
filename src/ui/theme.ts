import type { ElementId, WeatherId } from '../core/types';

/**
 * Minimal art: every visual identity (color + icon) lives here so real art can
 * replace it later without touching game code.
 */

/** An icon and a color. Names come from the language files (src/i18n). */
export interface Look {
  icon: string;
  color: string;
}

export const ELEMENTS: Record<ElementId, Look> = {
  fire: { icon: '🔥', color: '#f07b3f' },
  water: { icon: '💧', color: '#4aa3df' },
  earth: { icon: '🪨', color: '#a0845c' },
  air: { icon: '🌬️', color: '#9fd8cb' },
  spark: { icon: '⚡', color: '#f5d547' },
  frost: { icon: '❄️', color: '#bfe3f5' },
};

export const WEATHERS: Record<WeatherId, Look> = {
  clear: { icon: '🌤️', color: '#6fa8dc' },
  rain: { icon: '🌧️', color: '#3d5a80' },
  storm: { icon: '⛈️', color: '#4b3f72' },
  heatwave: { icon: '☀️', color: '#e07a2f' },
  snow: { icon: '🌨️', color: '#a9c6d9' },
};

export const ENEMY_LOOKS: Record<string, Look> = {
  cinderImp: { icon: '👿', color: '#e0603a' },
  stormCaller: { icon: '🧙', color: '#7b68c8' },
  drizzleSlime: { icon: '🫧', color: '#4aa3df' },
  frostGolem: { icon: '🗿', color: '#a9c6d9' },
  trainingDummy: { icon: '🎯', color: '#9aa3b8' },
  eyeOfTheStorm: { icon: '👁️', color: '#5b6bbf' },
  mireWitch: { icon: '🧌', color: '#6b8e4e' },
  skyHawk: { icon: '🐦', color: '#8fb3d9' },
  bogToad: { icon: '🐸', color: '#7a9a3a' },
  sparkWisp: { icon: '💫', color: '#f5d547' },
  rainmaker: { icon: '☔', color: '#4a78b5' },
  snowWolf: { icon: '🐺', color: '#c9d6e3' },
  stormRoc: { icon: '🦅', color: '#5a4f8a' },
  cauldronCrone: { icon: '🧙‍♀️', color: '#8e5ea2' },
  cinderDrake: { icon: '🐉', color: '#d9542b' },
};

export const RELIC_ICONS: Record<string, string> = {
  copperCauldron: '🍯',
  barometer: '🌡️',
  weathervane: '🐓',
  ironCauldron: '⚱️',
  rainBarrel: '🛢️',
  snowGlobe: '🔮',
  lightningRod: '📍',
  sunStone: '🌞',
  healingHerb: '🌿',
  luckyCoin: '🪙',
  alembic: '🏺',
  umbrella: '🌂',
  windChime: '🎐',
  dewcatcher: '🕸️',
  cloudSeed: '🌱',
};

export const NODE_ICONS = {
  fight: '⚔️',
  elite: '💀',
  rest: '🏕️',
  shop: '🛒',
  event: '❓',
  boss: '👁️',
} as const;

export const EVENT_ICONS: Record<string, string> = {
  abandonedCauldron: '🧪',
  struckOak: '🌳',
  weatherShrine: '⛩️',
  stormChaser: '🌪️',
  frozenTraveler: '🧊',
  wanderingAlchemist: '🧑‍🔬',
};

/** Card art for now is a single icon; cards without one use their kind's icon. */
export const CARD_ICONS: Record<string, string> = {
  emberBolt: '🔥',
  summonRain: '🌧️',
  gatherEmber: '🔥',
  gatherDew: '💧',
  gatherStone: '🪨',
  gatherGust: '🌬️',
  stir: '🥄',
  clearSkies: '🌤️',
  kindle: '☀️',
  callLightning: '⛈️',
  firstFrost: '🌨️',
  barometricShift: '🔄',
  holdTheSky: '⏳',
  doubleBoil: '♨️',
  twinEmbers: '🔥',
  deluge: '🌊',
  thunderclap: '💥',
  brace: '🧱',
  bottleIt: '🍶',
  pilfer: '🫳',
  curdle: '🤢',
  scatterClouds: '🌬️',
  frostbite: '🥶',
  sunstrike: '🔆',
  staticShock: '🌩️',
  undertow: '💦',
  clarity: '🔭',
  riptide: '🐚',
  galeForce: '🍃',
  earthenWall: '⛰️',
  staticCharge: '🔋',
  rime: '🧊',
  catchTheSky: '🥅',
  simmer: '🍲',
  catalyst: '✴️',
  boilOver: '🫕',
  weatherFront: '⏩',
  cloudburst: '☔',
};

/** A card's icon: its own, a flask or essence for distilled cards, or its kind's icon. */
export function cardIcon(def: { id: string; kind: 'attack' | 'skill' }): string {
  const own = CARD_ICONS[def.id];
  if (own) return own;
  if (def.id.startsWith('flask-')) return '⚗️';
  if (def.id.startsWith('essence-')) return '✨';
  return def.kind === 'attack' ? '⚔️' : '🛡️';
}

export const CARD_KIND_COLORS = {
  attack: '#d9534f',
  skill: '#3f7fbf',
} as const;

export const ICONS = {
  attack: '⚔️',
  block: '🛡️',
  energy: '⚡',
  hp: '❤️',
  drawPile: '📚',
  discardPile: '🗑️',
  burn: '🔥',
  weak: '🌀',
  lightning: '⚡',
  cauldron: '🧪',
  recipes: '📖',
  gold: '💰',
  potion: '🧴',
  cover: '☂️',
  sky: '☁️',
  spoiled: '🤢',
  grimoire: '📕',
  deck: '🂠',
  hunter: '🎯',
  settings: '⚙️',
  steal: '🫳',
  double: '✴️',
} as const;
