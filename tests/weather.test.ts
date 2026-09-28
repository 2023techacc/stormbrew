import { describe, expect, it } from 'vitest';
import { createCombat, endTurn, playCard, setWeather, type CombatSetup } from '../src/core/combat';
import { Rng } from '../src/core/rng';
import type { CombatState, WeatherId } from '../src/core/types';
import {
  STORM_BOLT_DAMAGE,
  WEATHER_INTERVAL,
  advanceWeather,
  createWeather,
  modifyDamage,
  skyWeather,
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
  it('moves to the forecast weather and never repeats the previous one', () => {
    const rng = new Rng(3);
    const weather = createWeather(rng);
    for (let turn = 1; turn < 50; turn++) {
      const previous = weather.current;
      const expected = weather.forecast[0];
      expect(advanceWeather(weather, rng, turn)).toBe(expected);
      expect(weather.current).not.toBe(previous);
      expect(weather.forecast).toHaveLength(2);
      expect(weather.nextChangeTurn).toBe(turn + WEATHER_INTERVAL);
    }
  });

  it('changes every WEATHER_INTERVAL turns when nothing interferes', () => {
    const s = newCombat({ playerHp: 500, playerMaxHp: 500 });
    expect(s.weather.current).toBe('clear');
    const changeTurns: number[] = [];
    let last = s.weather.current;
    for (let i = 0; i < 3 * WEATHER_INTERVAL; i++) {
      endTurn(s);
      if (s.weather.current !== last) changeTurns.push(s.turn);
      last = s.weather.current;
    }
    expect(changeTurns).toEqual([1 + WEATHER_INTERVAL, 1 + 2 * WEATHER_INTERVAL, 1 + 3 * WEATHER_INTERVAL]);
  });

  it('counts down to the next change', () => {
    const s = newCombat();
    const counts = [];
    for (let i = 0; i < WEATHER_INTERVAL + 1; i++) {
      counts.push(turnsUntilChange(s.weather, s.turn));
      endTurn(s);
    }
    expect(counts).toEqual([3, 2, 1, 3]);
  });

  it('a player weather change restarts the countdown and keeps the forecast', () => {
    const s = newCombat();
    endTurn(s); // turn 2
    const forecast = [...s.weather.forecast];
    const summoned = (['snow', 'rain'] as const).find((w) => w !== forecast[0]) ?? 'snow';
    setWeather(s, summoned, 'player');
    expect(s.weather.forecast).toEqual(forecast);
    // It lasts turns 2, 3 and 4, then changes to the forecast on turn 5.
    expect(turnsUntilChange(s.weather, s.turn)).toBe(WEATHER_INTERVAL);
    endTurn(s);
    endTurn(s);
    expect(s.turn).toBe(4);
    expect(s.weather.current).toBe(summoned);
    endTurn(s);
    expect(s.turn).toBe(5);
    expect(s.weather.current).toBe(forecast[0]);
  });

  it("an enemy's weather change lasts a full interval of the player's turns", () => {
    const s = newCombat({ enemies: ['stormCaller'], playerHp: 500, playerMaxHp: 500 });
    endTurn(s); // the Storm Caller calls a Storm at the end of turn 1
    expect(s.weather.current).toBe('storm');
    expect(turnsUntilChange(s.weather, s.turn)).toBe(WEATHER_INTERVAL);
  });

  it('skips a forecast of the weather that was just summoned', () => {
    const s = newCombat();
    const next = s.weather.forecast[0];
    if (!next) throw new Error('no forecast');
    setWeather(s, skyWeather(next), 'player');
    expect(s.weather.forecast[0]).not.toBe(next);
    expect(s.weather.forecast).toHaveLength(2);
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
