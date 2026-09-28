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
    text: 'Set the weather to Rain. Draw 1 card.',
  },
};

export const STARTER_DECK: string[] = [
  'strike',
  'strike',
  'strike',
  'strike',
  'defend',
  'defend',
  'defend',
  'defend',
  'emberBolt',
  'summonRain',
];

export function getCard(id: string): CardDef {
  const card = CARDS[id];
  if (!card) throw new Error(`Unknown card: ${id}`);
  return card;
}
