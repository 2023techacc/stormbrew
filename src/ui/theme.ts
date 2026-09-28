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
} as const;
