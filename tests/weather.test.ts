import { describe, expect, it } from 'vitest';
import { createCombat, endTurn, playCard, setWeather, type CombatSetup } from '../src/core/combat';
import { Rng } from '../src/core/rng';
import type { CombatState, WeatherId } from '../src/core/types';
import {
  STORM_BOLT_DAMAGE,
  WEATHER_INTERVAL,
  advanceWeather,
  createWeather,
  isScheduledChangeTurn,
  modifyDamage,
  turnsUntilChange,
} from '../src/core/weather';

const newCombat = (overrides: Partial<CombatSetup> = {}): CombatState =>
  createCombat({
    seed: 1,
    deck: ['defend', 'defend', 'defend', 'defend', 'defend'],
    enemies: ['cinderImp'],
    playerHp: 75,
    playerMaxHp: 75,
    ...overrides,
  }).state;

const imp = (s: CombatState) => {
  const enemy = s.enemies[0];
  if (!enemy) throw new Error('no enemy');
  return enemy;
};

/** Pins the weather for the rest of the fight by filling the forecast with it. */
const lockWeather = (s: CombatState, weather: WeatherId) => {
  s.weather.current = weather;
  s.weather.forecast = s.weather.forecast.map(() => weather);
};

describe('weather schedule', () => {
  it('changes on a fixed interval', () => {
    const changeTurns = Array.from({ length: 10 }, (_, i) => i + 1).filter(isScheduledChangeTurn);
    expect(changeTurns).toEqual([1 + WEATHER_INTERVAL, 1 + 2 * WEATHER_INTERVAL, 1 + 3 * WEATHER_INTERVAL]);
    expect([1, 2, 3, 4].map(turnsUntilChange)).toEqual([3, 2, 1, 3]);
  });

  it('moves to the forecast weather and never repeats the previous one', () => {
    const rng = new Rng(3);
    const weather = createWeather(rng);
    for (let i = 0; i < 50; i++) {
      const previous = weather.current;
      const expected = weather.forecast[0];
      expect(advanceWeather(weather, rng)).toBe(expected);
      expect(weather.current).not.toBe(previous);
      expect(weather.forecast).toHaveLength(2);
    }
  });

  it('starts clear and changes to the forecast at the scheduled turn', () => {
    const s = newCombat();
    expect(s.weather.current).toBe('clear');
    const forecast = s.weather.forecast[0];
    for (let turn = 1; turn < 1 + WEATHER_INTERVAL; turn++) {
      expect(s.weather.current).toBe('clear');
      endTurn(s);
    }
    expect(s.weather.current).toBe(forecast);
  });

  it('a manual change does not move the schedule or the forecast', () => {
    const s = newCombat();
    const forecast = [...s.weather.forecast];
    const events = setWeather(s, 'snow', 'player');
    expect(events).toEqual([{ type: 'weather', from: 'clear', to: 'snow', cause: 'player' }]);
    expect(s.weather.forecast).toEqual(forecast);
    for (let turn = 1; turn < 1 + WEATHER_INTERVAL; turn++) endTurn(s);
    expect(s.turn).toBe(1 + WEATHER_INTERVAL);
    expect(s.weather.current).toBe(forecast[0]);
  });

  it('Summon Rain sets the weather to Rain and draws a card', () => {
    const s = newCombat({ deck: ['summonRain', 'defend', 'defend', 'defend', 'defend', 'strike'] });
    const card = s.hand.find((c) => c.defId === 'summonRain');
    if (!card) throw new Error('no Summon Rain');
    const result = playCard(s, card.uid);
    expect(result.ok).toBe(true);
    expect(s.weather.current).toBe('rain');
    expect(s.hand).toHaveLength(5);
    expect(s.hand.some((c) => c.defId === 'strike')).toBe(true);
  });
});

describe('weather effects', () => {
  it('Rain weakens fire damage and Heatwave strengthens it', () => {
    expect(modifyDamage(8, 'fire', 'clear')).toBe(8);
    expect(modifyDamage(8, 'fire', 'rain')).toBe(6);
    expect(modifyDamage(8, 'fire', 'heatwave')).toBe(10);
    expect(modifyDamage(8, undefined, 'rain')).toBe(8);
    expect(modifyDamage(8, 'spark', 'heatwave')).toBe(8);
  });

  it("Rain softens the Cinder Imp's fire attacks", () => {
    const s = newCombat();
    lockWeather(s, 'rain');
    endTurn(s); // Claw: 7 fire → 5
    expect(s.player.hp).toBe(75 - 5);
  });

  it("Heatwave boosts the player's fire cards", () => {
    const s = newCombat({ deck: ['emberBolt', 'emberBolt', 'emberBolt', 'emberBolt', 'emberBolt'] });
    lockWeather(s, 'heatwave');
    const card = s.hand[0];
    if (!card) throw new Error('empty hand');
    playCard(s, card.uid, 0);
    expect(imp(s).hp).toBe(42 - 10);
  });

  it('Heatwave adds Burn each turn, which ticks down at end of turn (Weathered units are immune)', () => {
    const s = newCombat();
    lockWeather(s, 'heatwave');
    endTurn(s); // turn 2 starts in Heatwave: player gains 1 Burn
    expect(s.player.statuses.burn).toBe(1);
    expect(imp(s).statuses.burn).toBeUndefined(); // Cinder Imp is Weathered against Heatwave
    const hpBefore = s.player.hp;
    endTurn(s); // Burn 1 ticks (1 HP, ignores Block), then Smolder hits for 4 × 1.25 = 5
    expect(s.player.hp).toBe(hpBefore - 1 - 5);
  });

  it('Snow keeps enemy Block from wearing off', () => {
    const s = newCombat();
    endTurn(s); // Claw
    endTurn(s); // Smolder: the imp gains 6 Block
    expect(imp(s).block).toBe(6);
    lockWeather(s, 'snow');
    endTurn(s); // Flare: in Snow the imp keeps its Block
    expect(imp(s).block).toBe(6);
  });

  it('Snow Block carries over into the next turn', () => {
    const s = newCombat();
    lockWeather(s, 'snow');
    for (const card of s.hand.slice(0, 3)) playCard(s, card.uid); // 15 Block
    endTurn(s); // Claw 7 → 8 Block left
    expect(s.player.block).toBe(8);
  });

  it('Storm strikes one living unit for 5 at the end of each round', () => {
    const s = newCombat({ enemies: ['cinderImp', 'cinderImp'] });
    lockWeather(s, 'storm');
    const total = () => s.player.hp + s.enemies.reduce((sum, e) => sum + e.hp, 0);
    const before = total();
    const events = endTurn(s);
    const bolts = events.filter((e) => e.type === 'damage' && e.source === 'lightning');
    expect(bolts).toHaveLength(1);
    // Two Claws hit the player for 7 each, plus the bolt.
    expect(before - total()).toBe(7 + 7 + STORM_BOLT_DAMAGE);
  });

  it('the Storm Caller calls a Storm and is never hit by its lightning', () => {
    const s = newCombat({ enemies: ['stormCaller'], playerHp: 500, playerMaxHp: 500 });
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'weather', from: 'clear', to: 'storm', cause: 'enemy' });
    for (let i = 0; i < 20; i++) {
      s.weather.current = 'storm';
      endTurn(s);
      expect(s.enemies[0]?.hp).toBe(40);
    }
  });
});
