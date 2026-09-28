import type { CardDef } from '../core/types';

export const CARDS: Record<string, CardDef> = {
  strike: {
    id: 'strike',
    name: 'Strike',
    cost: 1,
    kind: 'attack',
    target: 'enemy',
    effects: [{ type: 'damage', amount: 6 }],
    text: 'Deal 6 damage.',
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
};

export const STARTER_DECK: string[] = [
  'strike',
  'strike',
  'strike',
  'strike',
  'strike',
  'defend',
  'defend',
  'defend',
  'defend',
  'defend',
];

export function getCard(id: string): CardDef {
  const card = CARDS[id];
  if (!card) throw new Error(`Unknown card: ${id}`);
  return card;
}
