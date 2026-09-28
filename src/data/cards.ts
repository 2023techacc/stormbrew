import type { CardDef } from '../core/types';

// Card text can use {damage}; the UI fills it in with the damage after weather.

export const CARDS: Record<string, CardDef> = {
  strike: {
    id: 'strike',
    name: 'Strike',
    cost: 1,
    kind: 'attack',
    target: 'enemy',
    effects: [{ type: 'damage', amount: 6 }],
    text: 'Deal {damage} damage.',
  },
  defend: {
    id: 'defend',
    name: 'Defend',
    cost: 1,
    kind: 'skill',
    target: 'self',
    effects: [{ type: 'block', amount: 5 }],
    text: 'Gain 5 Block.',
  },
  emberBolt: {
    id: 'emberBolt',
    name: 'Ember Bolt',
    cost: 1,
    kind: 'attack',
    target: 'enemy',
    effects: [{ type: 'damage', amount: 8, element: 'fire' }],
    text: 'Deal {damage} fire damage.',
  },
  gatherEmber: {
    id: 'gatherEmber',
    name: 'Gather Ember',
    cost: 1,
    kind: 'attack',
    target: 'enemy',
    effects: [
      { type: 'damage', amount: 4, element: 'fire' },
      { type: 'addElement', element: 'fire' },
    ],
    text: 'Deal {damage} fire damage. Add 🔥.',
  },
  gatherDew: {
    id: 'gatherDew',
    name: 'Gather Dew',
    cost: 1,
    kind: 'skill',
    target: 'self',
    effects: [
      { type: 'block', amount: 3 },
      { type: 'addElement', element: 'water' },
    ],
    text: 'Gain 3 Block. Add 💧.',
  },
  gatherStone: {
    id: 'gatherStone',
    name: 'Gather Stone',
    cost: 1,
    kind: 'skill',
    target: 'self',
    effects: [
      { type: 'block', amount: 4 },
      { type: 'addElement', element: 'earth' },
    ],
    text: 'Gain 4 Block. Add 🪨.',
  },
  gatherGust: {
    id: 'gatherGust',
    name: 'Gather Gust',
    cost: 1,
    kind: 'skill',
    target: 'self',
    effects: [
      { type: 'draw', amount: 1 },
      { type: 'addElement', element: 'air' },
    ],
    text: 'Draw 1 card. Add 🌬️.',
  },
  stir: {
    id: 'stir',
    name: 'Stir',
    cost: 0,
    kind: 'skill',
    target: 'self',
    effects: [{ type: 'brew' }],
    text: 'Brew the cauldron.',
  },
  summonRain: {
    id: 'summonRain',
    name: 'Summon Rain',
    cost: 1,
    kind: 'skill',
    target: 'self',
    effects: [
      { type: 'setWeather', weather: 'rain' },
      { type: 'draw', amount: 1 },
    ],
    text: 'Weather: Rain. Draw 1 card.',
  },
};

export const STARTER_DECK: string[] = [
  'strike',
  'strike',
  'strike',
  'defend',
  'defend',
  'defend',
  'gatherEmber',
  'gatherDew',
  'gatherStone',
  'gatherGust',
  'stir',
  'summonRain',
];

export function getCard(id: string): CardDef {
  const card = CARDS[id];
  if (!card) throw new Error(`Unknown card: ${id}`);
  return card;
}
