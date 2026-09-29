import { describe, expect, it } from 'vitest';
import {
  HAND_SIZE,
  PLAYER_MAX_ENERGY,
  createCombat,
  currentIntent,
  drawCards,
  endTurn,
  playCard,
  type CombatSetup,
} from '../src/core/combat';
import type { CombatState } from '../src/core/types';
import { STARTER_DECK } from '../src/data/cards';
import { enemyHp, enemyMove } from './helpers/data';

const IMP_HP = enemyHp('cinderImp');
const CLAW = enemyMove('cinderImp', 'Claw');
const SMOLDER = enemyMove('cinderImp', 'Smolder');

const setup = (overrides: Partial<CombatSetup> = {}): CombatSetup => ({
  seed: 1,
  deck: STARTER_DECK,
  enemies: ['cinderImp'],
  playerHp: 75,
  playerMaxHp: 75,
  ...overrides,
});

const newCombat = (overrides: Partial<CombatSetup> = {}): CombatState =>
  createCombat(setup(overrides)).state;

const totalCards = (s: CombatState) => s.drawPile.length + s.hand.length + s.discardPile.length;

const cardIn = (s: CombatState, defId: string) => {
  const card = s.hand.find((c) => c.defId === defId);
  if (!card) throw new Error(`no ${defId} in hand`);
  return card;
};

describe('combat setup', () => {
  it('starts turn 1 with a full hand and full energy', () => {
    const s = newCombat();
    expect(s.turn).toBe(1);
    expect(s.hand).toHaveLength(HAND_SIZE);
    expect(s.drawPile).toHaveLength(STARTER_DECK.length - HAND_SIZE);
    expect(s.player.energy).toBe(PLAYER_MAX_ENERGY);
    expect(s.status).toBe('playing');
    expect(s.enemies[0]?.hp).toBe(IMP_HP);
  });

  it('is deterministic for the same seed', () => {
    expect(newCombat({ seed: 5 })).toEqual(newCombat({ seed: 5 }));
  });

  it('can be saved and restored as JSON', () => {
    const s = newCombat();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('playing cards', () => {
  it('Strike damages the targeted enemy and costs 1 energy', () => {
    const s = newCombat({ deck: ['strike', 'strike', 'strike', 'strike', 'strike'] });
    const result = playCard(s, cardIn(s, 'strike').uid, 0);
    expect(result.ok).toBe(true);
    expect(s.enemies[0]?.hp).toBe(IMP_HP - 6);
    expect(s.player.energy).toBe(PLAYER_MAX_ENERGY - 1);
    expect(s.hand).toHaveLength(HAND_SIZE - 1);
    expect(s.discardPile).toHaveLength(1);
  });

  it('attacks need a living enemy target', () => {
    const s = newCombat({ deck: ['strike', 'strike', 'strike', 'strike', 'strike'] });
    const uid = cardIn(s, 'strike').uid;
    expect(playCard(s, uid).ok).toBe(false);
    expect(playCard(s, uid, 3).ok).toBe(false);
    expect(s.player.energy).toBe(PLAYER_MAX_ENERGY);
  });

  it('Defend gives Block without a target', () => {
    const s = newCombat({ deck: ['defend', 'defend', 'defend', 'defend', 'defend'] });
    expect(playCard(s, cardIn(s, 'defend').uid).ok).toBe(true);
    expect(s.player.block).toBe(5);
  });

  it('refuses cards the player cannot afford', () => {
    const s = newCombat({ deck: ['defend', 'defend', 'defend', 'defend', 'defend'] });
    for (let i = 0; i < PLAYER_MAX_ENERGY; i++) playCard(s, cardIn(s, 'defend').uid);
    const result = playCard(s, cardIn(s, 'defend').uid);
    expect(result).toEqual({ ok: false, reason: 'Not enough energy.' });
    expect(s.player.block).toBe(5 * PLAYER_MAX_ENERGY);
  });

  it('refuses cards that are not in hand', () => {
    const s = newCombat();
    const inDrawPile = s.drawPile[0];
    expect(inDrawPile && playCard(s, inDrawPile.uid, 0).ok).toBe(false);
  });

  it('wins when every enemy reaches 0 HP', () => {
    const s = newCombat({ deck: ['strike', 'strike', 'strike', 'strike', 'strike'] });
    const imp = s.enemies[0];
    if (!imp) throw new Error('no enemy');
    imp.hp = 6;
    playCard(s, cardIn(s, 'strike').uid, 0);
    expect(imp.hp).toBe(0);
    expect(s.status).toBe('won');
    expect(playCard(s, cardIn(s, 'strike').uid, 0).ok).toBe(false);
  });
});

describe('ending the turn', () => {
  it('enemies follow their intents in order and repeat', () => {
    const s = newCombat();
    const imp = s.enemies[0];
    if (!imp) throw new Error('no enemy');
    const seen = [];
    for (let i = 0; i < 4; i++) {
      seen.push(currentIntent(imp).name);
      endTurn(s);
    }
    expect(seen).toEqual(['Claw', 'Smolder', 'Flare', 'Claw']);
  });

  it('enemy attacks are reduced by Block, and Block resets next turn', () => {
    const s = newCombat({ deck: ['defend', 'defend', 'defend', 'defend', 'defend'] });
    playCard(s, cardIn(s, 'defend').uid); // 5 Block vs Claw
    endTurn(s);
    expect(s.player.hp).toBe(75 - (CLAW.damage - 5));
    expect(s.player.block).toBe(0);
  });

  it('enemy Block absorbs damage and wears off on its next turn', () => {
    const s = newCombat({ deck: ['strike', 'strike', 'strike', 'strike', 'strike'] });
    endTurn(s); // Claw
    endTurn(s); // Smolder: imp gains Block
    const imp = s.enemies[0];
    expect(imp?.block).toBe(SMOLDER.block);
    playCard(s, cardIn(s, 'strike').uid, 0); // 6 damage, all into the Block
    expect(imp?.block).toBe(SMOLDER.block - 6);
    expect(imp?.hp).toBe(IMP_HP);
    endTurn(s); // Flare: imp's Block is reset first
    expect(imp?.block).toBe(0);
  });

  it('discards the hand, refills energy, and draws a new hand', () => {
    const s = newCombat();
    playCard(s, s.hand.find((c) => c.defId === 'defend')?.uid ?? -1);
    endTurn(s);
    expect(s.turn).toBe(2);
    expect(s.player.energy).toBe(PLAYER_MAX_ENERGY);
    expect(s.hand).toHaveLength(HAND_SIZE);
    expect(totalCards(s)).toBe(STARTER_DECK.length);
  });

  it('shuffles the discard pile back in when the draw pile runs out', () => {
    const tenCards = ['strike', 'strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'defend'];
    const s = newCombat({ deck: tenCards });
    endTurn(s); // turn 2 draws the last 5 cards
    expect(s.drawPile).toHaveLength(0);
    const events = endTurn(s); // turn 3 must reshuffle
    expect(events.some((e) => e.type === 'shuffle')).toBe(true);
    expect(s.hand).toHaveLength(HAND_SIZE);
    expect(totalCards(s)).toBe(tenCards.length);
  });

  it('loses when the player reaches 0 HP', () => {
    const s = newCombat({ playerHp: 5 });
    endTurn(s); // Claw for 7
    expect(s.player.hp).toBe(0);
    expect(s.status).toBe('lost');
    expect(endTurn(s)).toEqual([]);
  });
});

describe('drawCards', () => {
  it('stops when both piles are empty', () => {
    const s = newCombat({ deck: ['strike', 'strike'] });
    expect(s.hand).toHaveLength(2);
    drawCards(s, 3);
    expect(s.hand).toHaveLength(2);
  });
});
