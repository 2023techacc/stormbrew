import type { RecipeDef } from '../core/types';

// Recipe text can use {damage}; the UI fills it in with the damage after weather.

export const RECIPES: RecipeDef[] = [
  // Two base elements: every pair has a recipe.
  {
    id: 'fireball',
    name: 'Fireball',
    elements: ['fire', 'fire'],
    effects: [{ type: 'damage', amount: 12, element: 'fire' }],
    text: 'Deal {damage} fire damage.',
  },
  {
    id: 'tonic',
    name: 'Tonic',
    elements: ['water', 'water'],
    effects: [
      { type: 'heal', amount: 2 },
      { type: 'block', amount: 7 },
    ],
    text: 'Heal 2. Gain 7 Block.',
  },
  {
    id: 'stoneskin',
    name: 'Stoneskin',
    elements: ['earth', 'earth'],
    effects: [{ type: 'block', amount: 12 }],
    text: 'Gain 12 Block.',
  },
  {
    id: 'tailwind',
    name: 'Tailwind',
    elements: ['air', 'air'],
    effects: [
      { type: 'draw', amount: 2 },
      { type: 'energy', amount: 1 },
    ],
    text: 'Draw 2 cards. Gain 1 energy.',
    cardText: 'Draw 2. Gain 1 energy.',
  },
  {
    id: 'steam',
    name: 'Steam',
    elements: ['fire', 'water'],
    effects: [{ type: 'applyStatus', status: 'weak', amount: 2, all: true }],
    text: 'Apply 2 Weak to ALL enemies.',
    cardText: 'Apply 2 Weak to ALL.',
  },
  {
    id: 'magma',
    name: 'Magma',
    elements: ['fire', 'earth'],
    effects: [
      { type: 'damage', amount: 7, element: 'fire' },
      { type: 'applyStatus', status: 'burn', amount: 3 },
    ],
    text: 'Deal {damage} fire damage. Apply 3 Burn.',
    cardText: 'Deal {damage} fire. Apply 3 Burn.',
  },
  {
    id: 'wildfire',
    name: 'Wildfire',
    elements: ['fire', 'air'],
    effects: [{ type: 'damage', amount: 6, element: 'fire', all: true }],
    text: 'Deal {damage} fire damage to ALL enemies.',
    cardText: 'Deal {damage} fire to ALL.',
  },
  {
    id: 'mud',
    name: 'Mud',
    elements: ['water', 'earth'],
    effects: [
      { type: 'block', amount: 7 },
      { type: 'applyStatus', status: 'weak', amount: 1 },
    ],
    text: 'Gain 7 Block. Apply 1 Weak.',
  },
  {
    id: 'rainCloud',
    name: 'Rain Cloud',
    elements: ['water', 'air'],
    effects: [
      { type: 'setWeather', weather: 'rain' },
      { type: 'block', amount: 4 },
    ],
    text: 'Set the weather to Rain. Gain 4 Block.',
    cardText: 'Weather: Rain. Gain 4 Block.',
  },
  {
    id: 'sandstorm',
    name: 'Sandstorm',
    elements: ['earth', 'air'],
    effects: [
      { type: 'damage', amount: 4, all: true },
      { type: 'block', amount: 4 },
    ],
    text: 'Deal {damage} damage to ALL enemies. Gain 4 Block.',
    cardText: 'Deal {damage} to ALL. Gain 4 Block.',
  },

  // A weather element plus a base element. Weather adds its element to every brew.
  {
    id: 'plasmaBolt',
    name: 'Plasma Bolt',
    elements: ['spark', 'fire'],
    effects: [{ type: 'damage', amount: 14, element: 'spark' }],
    text: 'Deal {damage} lightning damage.',
  },
  {
    id: 'conduction',
    name: 'Conduction',
    elements: ['spark', 'water'],
    effects: [{ type: 'damage', amount: 7, element: 'spark', all: true }],
    text: 'Deal {damage} lightning damage to ALL enemies.',
    cardText: 'Deal {damage} to ALL.',
  },
  {
    id: 'lodestone',
    name: 'Lodestone',
    elements: ['spark', 'earth'],
    effects: [
      { type: 'block', amount: 10 },
      { type: 'draw', amount: 1 },
    ],
    text: 'Gain 10 Block. Draw 1 card.',
    cardText: 'Gain 10 Block. Draw 1.',
  },
  {
    id: 'ballLightning',
    name: 'Ball Lightning',
    elements: ['spark', 'air'],
    effects: [
      { type: 'damage', amount: 9, element: 'spark' },
      { type: 'draw', amount: 1 },
    ],
    text: 'Deal {damage} lightning damage. Draw 1 card.',
    cardText: 'Deal {damage}. Draw 1.',
  },
  {
    id: 'thaw',
    name: 'Thaw',
    elements: ['frost', 'fire'],
    effects: [
      { type: 'heal', amount: 3 },
      { type: 'draw', amount: 1 },
    ],
    text: 'Heal 3. Draw 1 card.',
    cardText: 'Heal 3. Draw 1.',
  },
  {
    id: 'iceLance',
    name: 'Ice Lance',
    elements: ['frost', 'water'],
    effects: [
      { type: 'damage', amount: 10, element: 'frost' },
      { type: 'applyStatus', status: 'weak', amount: 2 },
    ],
    text: 'Deal {damage} frost damage. Apply 2 Weak.',
    cardText: 'Deal {damage}. Apply 2 Weak.',
  },
  {
    id: 'permafrost',
    name: 'Permafrost',
    elements: ['frost', 'earth'],
    effects: [{ type: 'block', amount: 15 }],
    text: 'Gain 15 Block.',
  },
  {
    id: 'blizzard',
    name: 'Blizzard',
    elements: ['frost', 'air'],
    effects: [
      { type: 'setWeather', weather: 'snow' },
      { type: 'block', amount: 6 },
    ],
    text: 'Set the weather to Snow. Gain 6 Block.',
    cardText: 'Weather: Snow. Gain 6 Block.',
  },

  // Three elements: stronger, and they take a whole cauldron.
  {
    id: 'heatHaze',
    name: 'Heat Haze',
    elements: ['fire', 'fire', 'air'],
    effects: [
      { type: 'setWeather', weather: 'heatwave' },
      { type: 'damage', amount: 6, element: 'fire', all: true },
    ],
    text: 'Set the weather to Heatwave. Deal {damage} fire damage to ALL enemies.',
    cardText: 'Weather: Heatwave. {damage} to ALL.',
  },
  {
    id: 'thunderhead',
    name: 'Thunderhead',
    elements: ['water', 'air', 'spark'],
    effects: [
      { type: 'setWeather', weather: 'storm' },
      { type: 'damage', amount: 10, element: 'spark' },
    ],
    text: 'Set the weather to Storm. Deal {damage} lightning damage.',
    cardText: 'Weather: Storm. Deal {damage}.',
  },
  {
    id: 'downpour',
    name: 'Downpour',
    elements: ['water', 'water', 'air'],
    effects: [
      { type: 'setWeather', weather: 'rain' },
      { type: 'heal', amount: 3 },
      { type: 'block', amount: 7 },
    ],
    text: 'Set the weather to Rain. Heal 3. Gain 7 Block.',
    cardText: 'Weather: Rain. Heal 3. Gain 7 Block.',
  },
];

/** What a brew becomes when no recipe matches. */
export const SLUDGE: RecipeDef = {
  id: 'sludge',
  name: 'Sludge',
  elements: [],
  effects: [{ type: 'block', amount: 2 }],
  text: 'Nothing matched. Gain 2 Block.',
};

export function getRecipe(id: string): RecipeDef {
  const recipe = id === SLUDGE.id ? SLUDGE : RECIPES.find((r) => r.id === id);
  if (!recipe) throw new Error(`Unknown recipe: ${id}`);
  return recipe;
}
