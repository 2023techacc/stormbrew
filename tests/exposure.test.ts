import { describe, expect, it } from 'vitest';
import { createCombat, endTurn, toggleExposure, type CombatSetup } from '../src/core/combat';
import type { CombatState, WeatherId } from '../src/core/types';
import { enemyHp } from './helpers/data';

const newCombat = (overrides: Partial<CombatSetup> = {}): CombatState =>
  createCombat({
    seed: 1,
    deck: ['defend', 'defend', 'defend', 'defend', 'defend'],
    enemies: ['trainingDummy'],
    playerHp: 500,
    playerMaxHp: 500,
    ...overrides,
  }).state;

const lockWeather = (s: CombatState, weather: WeatherId) => {
  s.weather.current = weather;
  s.weather.forecast = s.weather.forecast.map(() => weather);
};

describe('exposure', () => {
  it('starts out in the open and can toggle freely', () => {
    const s = newCombat();
    expect(s.player.exposed).toBe(true);
    expect(toggleExposure(s)).toEqual([{ type: 'exposure', exposed: false }]);
    expect(s.player.exposed).toBe(false);
    toggleExposure(s);
    expect(s.player.exposed).toBe(true);
  });

  it('out in the open, you catch the weather element each turn', () => {
    const catches: [WeatherId, string][] = [
      ['rain', 'water'],
      ['storm', 'spark'],
      ['heatwave', 'fire'],
      ['snow', 'frost'],
    ];
    for (const [weather, element] of catches) {
      const s = newCombat();
      lockWeather(s, weather);
      const events = endTurn(s);
      expect(events).toContainEqual({ type: 'element', element, fromWeather: true });
      expect(s.cauldron).toEqual([element]);
    }
  });

  it('clear skies drop nothing', () => {
    const s = newCombat();
    lockWeather(s, 'clear');
    endTurn(s);
    expect(s.cauldron).toEqual([]);
  });

  it('under cover, you catch nothing', () => {
    const s = newCombat();
    lockWeather(s, 'rain');
    toggleExposure(s);
    endTurn(s);
    expect(s.cauldron).toEqual([]);
  });

  it('a full cauldron spills the caught element', () => {
    const s = newCombat();
    lockWeather(s, 'rain');
    s.cauldron = ['earth', 'earth', 'earth'];
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'spill', element: 'water' });
    expect(s.cauldron).toEqual(['earth', 'earth', 'earth']);
  });

  it('under cover, lightning never hits you', () => {
    const s = newCombat({ enemies: ['cinderImp'] });
    toggleExposure(s);
    for (let i = 0; i < 15 && s.status === 'playing'; i++) {
      lockWeather(s, 'storm');
      const events = endTurn(s);
      const hitMe = events.some((e) => e.type === 'damage' && e.source === 'lightning' && e.target.side === 'player');
      expect(hitMe).toBe(false);
    }
  });

  it('out in a Storm, lightning can hit you', () => {
    const s = newCombat({ enemies: ['trainingDummy'] });
    let hits = 0;
    for (let i = 0; i < 20; i++) {
      lockWeather(s, 'storm');
      const events = endTurn(s);
      if (events.some((e) => e.type === 'damage' && e.source === 'lightning' && e.target.side === 'player')) hits++;
    }
    expect(hits).toBeGreaterThan(0);
  });

  it('under cover, Heatwave gives you no Burn', () => {
    const s = newCombat();
    lockWeather(s, 'heatwave');
    toggleExposure(s);
    endTurn(s);
    expect(s.player.statuses.burn).toBeUndefined();
  });

  it('sheltered enemies are never hit by the weather', () => {
    const s = newCombat({ enemies: ['drizzleSlime'] });
    toggleExposure(s); // so every bolt would have to hit the slime
    for (let i = 0; i < 10; i++) {
      lockWeather(s, 'storm');
      endTurn(s);
    }
    expect(s.enemies[0]?.hp).toBe(enemyHp('drizzleSlime'));
  });
});
