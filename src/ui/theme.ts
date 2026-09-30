import type { NodeType } from '../core/map';
import type { CardKind, ElementId, WeatherId } from '../core/types';
import { getAct } from '../data/acts';

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
  // Act 2: the Frostpeaks.
  iceBat: { icon: '🦇', color: '#9fc3e0' },
  frostMammoth: { icon: '🦣', color: '#b8c7d6' },
  sleetSprite: { icon: '🧚', color: '#bfe3f5' },
  thunderRam: { icon: '🐏', color: '#d6c16a' },
  stormEel: { icon: '🐍', color: '#6fd0c9' },
  glacierTitan: { icon: '🗻', color: '#9dc3e6' },
  rimeWitch: { icon: '🧝‍♀️', color: '#a7d8f0' },
  thunderOwl: { icon: '🦉', color: '#8c7ae6' },
  frostWyrm: { icon: '🐲', color: '#9fd3f5' },
  // Act 3: the Sky Citadel.
  lavaLizard: { icon: '🦎', color: '#e0602a' },
  stormElemental: { icon: '🌪️', color: '#8c95d6' },
  brassAutomaton: { icon: '🤖', color: '#c9a45a' },
  emberWraith: { icon: '👻', color: '#e08a4a' },
  cloudShark: { icon: '🦈', color: '#7fa3c9' },
  magmaColossus: { icon: '🌋', color: '#d9542b' },
  tempestDjinn: { icon: '🧞', color: '#6f7fd6' },
  grandAlchemist: { icon: '🧑‍🔬', color: '#8e7cc3' },
  heartOfTheStorm: { icon: '🌀', color: '#5b6bbf' },
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
  emberCharm: '🧨',
  frostCharm: '🧿',
  kiln: '🪵',
  sunlitLantern: '🏮',
  beltPouch: '👝',
  heartyStew: '🥘',
  mastersNotes: '📗',
  goldenScale: '⚖️',
  // Boss relics.
  stormVow: '💓',
  skyAnchor: '⚓',
  philosophersStone: '💎',
  grandGrimoire: '📜',
  bottomlessFlask: '🥃',
  thunderDrum: '🥁',
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
  oldObservatory: '🔭',
  frozenLake: '🏞️',
  lightningForge: '⚒️',
  skyMerchant: '🎈',
  stormAltar: '🛐',
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
  fanTheFlames: '🪔',
  forkedLightning: '🔱',
  whisk: '🥣',
  fogBank: '🌫️',
  snowdrift: '☃️',
  heatShimmer: '🏜️',
  hailstones: '☄️',
  // Rare cards.
  conductor: '🎼',
  steadyHands: '🧤',
  skyHarvest: '🧺',
  perfectBrew: '🫖',
  lightningStorm: '🎇',
  sunbreak: '🌅',
  hoarfrost: '💠',
  avalanche: '🏔️',
};

/** A card's icon: its own, a flask or essence for distilled cards, or its kind's icon. */
export function cardIcon(def: { id: string; kind: CardKind }): string {
  const own = CARD_ICONS[def.id];
  if (own) return own;
  if (def.id.startsWith('flask-')) return '⚗️';
  if (def.id.startsWith('essence-')) return '✨';
  return def.kind === 'attack' ? '⚔️' : def.kind === 'power' ? '♾️' : '🛡️';
}

/** Attacks are red, skills blue, and Lasting cards (powers) violet. */
export const CARD_KIND_COLORS: Record<CardKind, string> = {
  attack: '#d9534f',
  skill: '#3f7fbf',
  power: '#9b6bd6',
};

/** The gold of rare cards. */
export const RARE_COLOR = '#e8c35a';

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
  heal: '💚',
  shatter: '🔨',
  anchor: '⚓',
  crown: '👑',
  rare: '★',
  lasting: '♾️',
} as const;

/** A map spot's icon; an act's boss spot shows that act's boss. */
export function nodeIcon(type: NodeType, act: number): string {
  if (type !== 'boss') return NODE_ICONS[type];
  const id = getAct(act).encounters.boss[0]?.[0];
  return (id && ENEMY_LOOKS[id]?.icon) || NODE_ICONS.boss;
}
