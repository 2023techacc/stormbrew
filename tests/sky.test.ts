import { describe, expect, it } from 'vitest';
import { createCombat, endTurn, playCard, toggleExposure, type CombatSetup } from '../src/core/combat';
import { Rng } from '../src/core/rng';
import { BOSS_ID, type MapNode } from '../src/core/map';
import { MIN_SKY, availableNodes, buySky, chartSky, createRun, enterNode, startFight, type RunState } from '../src/core/run';
import type { CombatState } from '../src/core/types';
import { advanceWeather, createWeather, skyWeather } from '../src/core/weather';
import { STARTING_SKY } from '../src/data/sky';

const newCombat = (overrides: Partial<CombatSetup> = {}): CombatState => {
  const s = createCombat({
    seed: 1,
    deck: ['defend', 'defend', 'defend', 'defend', 'defend'],
    enemies: ['trainingDummy'],
    playerHp: 500,
    playerMaxHp: 500,
    ...overrides,
  }).state;
  toggleExposure(s); // keep the cauldron out of it
  return s;
};

describe('the sky deck', () => {
  it('draws the forecast from the sky deck', () => {
    const rng = new Rng(1);
    const weather = createWeather(rng, 'clear', ['rain', 'snow']);
    expect(weather.forecast.map(skyWeather).sort()).toEqual(['rain', 'snow']);
  });

  it('never changes to the same weather while the sky has another', () => {
    const rng = new Rng(2);
    const weather = createWeather(rng, 'clear', ['rain', 'rain', 'rain', 'snow']);
    let previous = weather.current;
    for (let turn = 1; turn < 40; turn++) {
      const now = advanceWeather(weather, rng, turn);
      expect(now).not.toBe(previous);
      previous = now;
    }
  });

  it('reshuffles when the pile runs out', () => {
    const rng = new Rng(3);
    const weather = createWeather(rng, 'clear', STARTING_SKY);
    const seen: string[] = [];
    for (let turn = 1; turn < 30; turn++) seen.push(advanceWeather(weather, rng, turn));
    expect(new Set(seen).size).toBe(5);
    expect(weather.skyDeck).toEqual(STARTING_SKY);
  });

  it('a weather card lasts as long as it says (Monsoon: 5 turns)', () => {
    const s = newCombat({ sky: ['monsoon'] });
    expect(s.weather.forecast[0]).toBe('monsoon');
    endTurn(s);
    endTurn(s);
    endTurn(s); // turn 4: Monsoon arrives
    expect(s.weather.current).toBe('rain');
    expect(s.weather.currentCard).toBe('monsoon');
    expect(s.weather.nextChangeTurn).toBe(4 + 5);
  });

  it('a Squall is a short Storm', () => {
    const s = newCombat({ sky: ['squall'] });
    for (let i = 0; i < 3; i++) endTurn(s);
    expect(s.weather.current).toBe('storm');
    expect(s.weather.nextChangeTurn).toBe(4 + 2);
  });

  it('the Storm Caller shuffles Storms into your sky', () => {
    const s = newCombat({ enemies: ['stormCaller'] });
    const caller = s.enemies[0];
    if (!caller) throw new Error('no enemy');
    caller.moveIndex = 2; // Gather Clouds
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'skyAdded', index: 0, cards: ['storm', 'storm'] });
    expect(s.weather.skyDeck.filter((c) => c === 'storm')).toHaveLength(3);
  });

  it('Scatter Clouds replaces the next forecast weather', () => {
    const s = newCombat({ deck: ['scatterClouds'], sky: ['rain', 'snow', 'storm', 'heatwave'] });
    const before = [...s.weather.forecast];
    const card = s.hand[0];
    if (!card) throw new Error('empty hand');
    expect(playCard(s, card.uid).ok).toBe(true);
    expect(s.weather.forecast[0]).toBe(before[1]);
    expect(s.weather.forecast).toHaveLength(2);
  });
});

/** Adds a node of the given type next to the player's position and walks there. */
const placeAt = (run: RunState, type: MapNode['type']): MapNode => {
  if (run.nodeId === null) enterNode(run, availableNodes(run)[0]?.id ?? '');
  const node: MapNode = { id: `test-${type}-${run.visited.length}`, floor: 5, lane: 0, type, next: [BOSS_ID] };
  run.map.nodes[node.id] = node;
  run.map.nodes[run.nodeId ?? '']?.next.push(node.id);
  return enterNode(run, node.id);
};

describe('the sky deck in runs', () => {
  it('starts with one of each basic weather and is used in fights', () => {
    const run = createRun(1);
    expect(run.sky).toEqual(STARTING_SKY);
    run.sky = ['monsoon', 'squall'];
    placeAt(run, 'fight');
    expect(startFight(run).state.weather.skyDeck).toEqual(['monsoon', 'squall']);
  });

  it('shops sell weather cards', () => {
    const run = createRun(2);
    placeAt(run, 'shop');
    run.gold = 1000;
    const card = run.shop?.sky[0];
    expect(buySky(run, 0).ok).toBe(true);
    expect(run.sky.at(-1)).toBe(card?.id);
    expect(buySky(run, 0)).toEqual({ ok: false, reason: 'Sold out.' });
  });

  it('charting the sky removes a weather card, down to a minimum', () => {
    const run = createRun(3);
    expect(chartSky(run, 0).ok).toBe(true);
    expect(run.sky).toEqual(STARTING_SKY.slice(1));
    while (run.sky.length > MIN_SKY) chartSky(run, 0);
    expect(chartSky(run, 0).ok).toBe(false);
    expect(run.sky).toHaveLength(MIN_SKY);
  });
});
