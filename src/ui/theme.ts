import type { ElementId } from '../core/types';

/**
 * Minimal art: every visual identity (color + icon) lives here so real art can
 * replace it later without touching game code.
 */

export interface Look {
  name: string;
  icon: string;
  color: string;
}

export const ELEMENTS: Record<ElementId, Look> = {
  fire: { name: 'Fire', icon: '🔥', color: '#f07b3f' },
  water: { name: 'Water', icon: '💧', color: '#4aa3df' },
  earth: { name: 'Earth', icon: '🪨', color: '#a0845c' },
  air: { name: 'Air', icon: '🌬️', color: '#9fd8cb' },
  spark: { name: 'Spark', icon: '⚡', color: '#f5d547' },
  frost: { name: 'Frost', icon: '❄️', color: '#bfe3f5' },
};

export const WEATHERS = {
  clear: { name: 'Clear', icon: '🌤️', color: '#6fa8dc' },
  rain: { name: 'Rain', icon: '🌧️', color: '#3d5a80' },
  storm: { name: 'Storm', icon: '⛈️', color: '#4b3f72' },
  heatwave: { name: 'Heatwave', icon: '☀️', color: '#e07a2f' },
  snow: { name: 'Snow', icon: '🌨️', color: '#a9c6d9' },
} satisfies Record<string, Look>;

export const ENEMY_LOOKS: Record<string, Look> = {
  cinderImp: { name: 'Cinder Imp', icon: '👿', color: '#e0603a' },
  stormCaller: { name: 'Storm Caller', icon: '🧙', color: '#7b68c8' },
  drizzleSlime: { name: 'Drizzle Slime', icon: '🫧', color: '#4aa3df' },
  frostGolem: { name: 'Frost Golem', icon: '🗿', color: '#a9c6d9' },
  trainingDummy: { name: 'Training Dummy', icon: '🎯', color: '#9aa3b8' },
  eyeOfTheStorm: { name: 'Eye of the Storm', icon: '👁️', color: '#5b6bbf' },
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
};

export const NODE_ICONS = {
  fight: '⚔️',
  elite: '💀',
  rest: '🏕️',
  shop: '🛒',
  boss: '👁️',
} as const;

export const NODE_NAMES = {
  fight: 'Fight',
  elite: 'Elite',
  rest: 'Rest site',
  shop: 'Shop',
  boss: 'Boss',
} as const;

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
};

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
  deck: '🂠',
} as const;
