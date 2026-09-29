import { describe, expect, it } from 'vitest';
import { createCombat, endTurn, enemyBrewPreview, playCard, toggleExposure, type CombatSetup } from '../src/core/combat';
import { createGrimoire, discoverFrom } from '../src/core/grimoire';
import type { CombatState, EnemyState } from '../src/core/types';
import { getRecipe } from '../src/data/recipes';
import { enemyMove } from './helpers/data';

const newCombat = (overrides: Partial<CombatSetup> = {}): CombatState => {
  const s = createCombat({
    seed: 1,
    deck: ['defend', 'defend', 'defend', 'defend', 'defend'],
    enemies: ['mireWitch'],
    playerHp: 500,
    playerMaxHp: 500,
    ...overrides,
  }).state;
  // Stay under cover and keep the sky clear, so only the enemy's brewing matters.
  toggleExposure(s);
  s.weather.forecast = s.weather.forecast.map(() => 'clear');
  return s;
};

const witch = (s: CombatState): EnemyState => {
  const enemy = s.enemies[0];
  if (!enemy) throw new Error('no enemy');
  return enemy;
};

const play = (s: CombatState, defId: string, target?: number) => {
  const card = s.hand.find((c) => c.defId === defId);
  if (!card) throw new Error(`no ${defId} in hand`);
  const result = playCard(s, card.uid, target);
  if (!result.ok) throw new Error(result.reason);
  return result.events;
};

describe('enemy cauldrons', () => {
  it('a brewing enemy gathers an element after each move', () => {
    const s = newCombat();
    expect(witch(s).cauldron).toEqual([]);
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'enemyGather', index: 0, element: 'fire' });
    expect(witch(s).cauldron).toEqual(['fire']);
  });

  it('shows what it will brew this turn, and brews it against you when full', () => {
    const s = newCombat();
    expect(enemyBrewPreview(witch(s))).toBeNull();
    endTurn(s); // Hex (5) + gather Fire
    expect(enemyBrewPreview(witch(s))?.id).toBe('fireball');
    const hp = s.player.hp;
    const events = endTurn(s); // Ward, gather Fire, brew Fireball (12)
    expect(events).toContainEqual({ type: 'enemyBrew', index: 0, recipeId: 'fireball', used: ['fire', 'fire'] });
    expect(hp - s.player.hp).toBe(12);
    expect(witch(s).cauldron).toEqual([]);
  });

  it('defensive brews help the enemy (Tonic heals and blocks)', () => {
    const s = newCombat();
    witch(s).gatherIndex = 2; // next: Water, Water
    witch(s).hp = 20;
    endTurn(s); // Hex, gather Water
    endTurn(s); // Ward (Block), gather Water, brew Tonic (heal and Block)
    const tonic = getRecipe('tonic').effects;
    const amount = (type: 'heal' | 'block') => tonic.reduce((sum, e) => sum + (e.type === type ? e.amount : 0), 0);
    expect(witch(s).hp).toBe(20 + amount('heal'));
    expect(witch(s).block).toBe(enemyMove('mireWitch', 'Ward').block + amount('block'));
  });

  it('Pilfer steals the newest element into your cauldron', () => {
    const s = newCombat({ deck: ['pilfer', 'pilfer', 'defend', 'defend', 'defend'] });
    witch(s).cauldron = ['fire'];
    const events = play(s, 'pilfer', 0);
    expect(events).toContainEqual({ type: 'pilfer', index: 0, element: 'fire', kept: true });
    expect(witch(s).cauldron).toEqual([]);
    expect(s.cauldron).toEqual(['fire']);
  });

  it('a stolen element is lost if your cauldron is full', () => {
    const s = newCombat({ deck: ['pilfer', 'defend', 'defend', 'defend', 'defend'] });
    witch(s).cauldron = ['fire'];
    s.cauldron = ['earth', 'earth', 'earth'];
    const events = play(s, 'pilfer', 0);
    expect(events).toContainEqual({ type: 'pilfer', index: 0, element: 'fire', kept: false });
    expect(witch(s).cauldron).toEqual([]);
    expect(s.cauldron).toEqual(['earth', 'earth', 'earth']);
  });

  it('Curdle spoils the next brew into Sludge', () => {
    const s = newCombat({ deck: ['curdle'] }); // a one-card deck: it's in hand every turn
    endTurn(s); // witch gathers Fire
    play(s, 'curdle', 0);
    expect(witch(s).spoiled).toBe(true);
    expect(enemyBrewPreview(witch(s))?.id).toBe('sludge');
    const hp = s.player.hp;
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'enemyBrew', index: 0, recipeId: 'sludge', used: ['fire', 'fire'] });
    expect(s.player.hp).toBe(hp); // Ward only, no Fireball
    expect(witch(s).spoiled).toBe(false);
  });

  it('the Eye of the Storm brews what it steals from you', () => {
    const s = newCombat({ enemies: ['eyeOfTheStorm'] });
    const eye = witch(s);
    eye.hp = 50; // phase 2: its moves steal
    eye.moveIndex = 0; // Siphon (steals)
    s.cauldron = ['fire', 'fire', 'fire'];
    endTurn(s);
    expect(eye.cauldron).toEqual(['fire']);
    expect(s.cauldron).toEqual(['fire', 'fire']);
  });

  it('watching an enemy brew teaches you the recipe', () => {
    const s = newCombat();
    const grimoire = createGrimoire();
    endTurn(s);
    expect(discoverFrom(grimoire, endTurn(s))).toEqual(['fireball']);
  });
});
