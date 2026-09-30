import { describe, expect, it } from 'vitest';
import {
  createCombat,
  endTurn,
  enemyAttackDamage,
  enemyMoveBlock,
  toggleExposure,
  type CombatSetup,
} from '../src/core/combat';
import type { CombatState, EnemyState, WeatherId } from '../src/core/types';
import { ACTS } from '../src/data/acts';
import { enemyMove } from './helpers/data';

const newCombat = (enemies: string[], overrides: Partial<CombatSetup> = {}): CombatState =>
  createCombat({
    seed: 1,
    deck: ['defend', 'defend', 'defend', 'defend', 'defend'],
    enemies,
    playerHp: 500,
    playerMaxHp: 500,
    ...overrides,
  }).state;

const first = (s: CombatState): EnemyState => {
  const enemy = s.enemies[0];
  if (!enemy) throw new Error('no enemy');
  return enemy;
};

/** Keeps the sky on one weather for the rest of the fight. */
const lockWeather = (s: CombatState, weather: WeatherId) => {
  s.weather.current = weather;
  s.weather.forecast = s.weather.forecast.map(() => weather);
};

describe('hunters', () => {
  const dive = enemyMove('skyHawk', 'Dive');

  it("dive harder at a player out in the open, and the intent shows it", () => {
    const s = newCombat(['skyHawk']);
    expect(enemyAttackDamage(first(s), dive, 'clear', true)).toBe(dive.damage + (dive.exposedBonus ?? 0));
    expect(enemyAttackDamage(first(s), dive, 'clear', false)).toBe(dive.damage);
  });

  it('hit for less when you take cover', () => {
    const out = newCombat(['skyHawk']);
    const cover = newCombat(['skyHawk']);
    toggleExposure(cover);
    for (const s of [out, cover]) {
      lockWeather(s, 'clear');
      first(s).moveIndex = 1; // Dive
      endTurn(s);
    }
    expect(500 - out.player.hp).toBe(dive.damage + (dive.exposedBonus ?? 0));
    expect(500 - cover.player.hp).toBe(dive.damage);
  });
});

describe('attuned moves', () => {
  it('hit harder in their weather', () => {
    const s = newCombat(['snowWolf']);
    const pounce = enemyMove('snowWolf', 'Pounce');
    expect(enemyAttackDamage(first(s), pounce, 'snow')).toBe(pounce.damage + (pounce.attuned?.damage ?? 0));
    expect(enemyAttackDamage(first(s), pounce, 'clear')).toBe(pounce.damage);
  });

  it('can give Block too (the Rainmaker shields itself in Rain)', () => {
    const deluge = enemyMove('rainmaker', 'Deluge');
    expect(enemyMoveBlock(deluge, 'rain')).toBe(deluge.block + (deluge.attuned?.block ?? 0));
    expect(enemyMoveBlock(deluge, 'clear')).toBe(deluge.block);
  });
});

describe('new enemies', () => {
  it('the Rainmaker seeds your sky with a Monsoon', () => {
    const s = newCombat(['rainmaker']);
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'skyAdded', index: 0, cards: ['monsoon'] });
    expect(s.weather.skyDeck).toContain('monsoon');
  });

  it("the Bog Toad's Tongue steals from your cauldron", () => {
    const s = newCombat(['bogToad']);
    toggleExposure(s);
    first(s).moveIndex = 1; // Tongue
    s.cauldron = ['fire'];
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'steal', index: 0, element: 'fire' });
    expect(s.cauldron).toEqual([]);
  });

  it('the Cauldron Crone brews Heat Haze at you', () => {
    const s = newCombat(['cauldronCrone']);
    toggleExposure(s);
    lockWeather(s, 'clear');
    const crone = first(s);
    crone.moveIndex = 2; // Stir the Pot
    crone.cauldron = ['fire', 'fire'];
    crone.gatherIndex = 2; // next: Air
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'enemyBrew', index: 0, recipeId: 'heatHaze', used: ['fire', 'fire', 'air'] });
    expect(s.weather.current).toBe('heatwave');
  });

  it('the Cinder Drake calls a Heatwave and adds a Heat Dome to your sky', () => {
    const s = newCombat(['cinderDrake']);
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'weather', from: 'clear', to: 'heatwave', cause: 'enemy' });
    expect(events).toContainEqual({ type: 'skyAdded', index: 0, cards: ['heatDome'] });
  });

  it('elites are their own enemies, never seen in normal fights', () => {
    for (const { encounters } of ACTS) {
      const normal = new Set([...encounters.easy, ...encounters.hard].flat());
      expect(encounters.elite.length).toBeGreaterThanOrEqual(3);
      expect(encounters.boss).toHaveLength(1);
      for (const group of encounters.elite) for (const id of group) expect(normal.has(id), id).toBe(false);
    }
  });
});
