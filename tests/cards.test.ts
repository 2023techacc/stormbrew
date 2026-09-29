import { describe, expect, it } from 'vitest';
import { cannotPlayReason, createCombat, isAttuned, playCard, type CombatSetup } from '../src/core/combat';
import type { CombatState, ElementId } from '../src/core/types';
import { getSkyCard } from '../src/data/sky';
import { skyWeather } from '../src/core/weather';

const DUMMY_HP = 999;

/** A fight against the training dummy, which never attacks. */
const newCombat = (deck: string[], overrides: Partial<CombatSetup> = {}): CombatState =>
  createCombat({ seed: 1, deck, enemies: ['trainingDummy'], playerHp: 75, playerMaxHp: 75, ...overrides }).state;

const play = (s: CombatState, defId: string, target?: number) => {
  const card = s.hand.find((c) => c.defId === defId);
  if (!card) throw new Error(`no ${defId} in hand`);
  const result = playCard(s, card.uid, target);
  if (!result.ok) throw new Error(result.reason);
  return result.events;
};

const dummy = (s: CombatState, index = 0) => {
  const enemy = s.enemies[index];
  if (!enemy) throw new Error('no enemy');
  return enemy;
};

describe('attuned cards', () => {
  it('get their bonus only in their weather', () => {
    const s = newCombat(['frostbite', 'frostbite']);
    expect(isAttuned('frostbite', 'clear')).toBe(false);
    play(s, 'frostbite', 0);
    expect(dummy(s).hp).toBe(DUMMY_HP - 6);
    expect(dummy(s).statuses.weak).toBeUndefined();
    s.weather.current = 'snow';
    expect(isAttuned('frostbite', 'snow')).toBe(true);
    play(s, 'frostbite', 0);
    expect(dummy(s).statuses.weak).toBe(2);
  });

  it('Static Shock gives its energy back in a Storm', () => {
    const s = newCombat(['staticShock']);
    s.weather.current = 'storm';
    play(s, 'staticShock', 0);
    expect(s.player.energy).toBe(3);
  });

  it('Clarity draws 3 cards in Clear', () => {
    const s = newCombat(['clarity', ...Array<string>(8).fill('defend')]);
    // The deck is shuffled: make sure Clarity is in hand.
    const clarity = [...s.hand, ...s.drawPile].find((c) => c.defId === 'clarity');
    if (!clarity) throw new Error('no clarity');
    s.drawPile = s.drawPile.filter((c) => c !== clarity);
    s.hand = [...s.hand.filter((c) => c !== clarity), clarity];
    const handSize = s.hand.length;
    play(s, 'clarity');
    expect(s.hand).toHaveLength(handSize - 1 + 3);
  });
});

describe('element cards', () => {
  it('add their elements', () => {
    const cases: [string, ElementId][] = [
      ['riptide', 'water'],
      ['galeForce', 'air'],
      ['earthenWall', 'earth'],
      ['staticCharge', 'spark'],
      ['rime', 'frost'],
    ];
    for (const [id, element] of cases) {
      const s = newCombat([id]);
      play(s, id, 0);
      expect(s.cauldron, id).toEqual([element]);
    }
  });

  it("Catch the Sky adds the weather's element (nothing in Clear)", () => {
    const clear = newCombat(['catchTheSky', 'defend']);
    play(clear, 'catchTheSky');
    expect(clear.cauldron).toEqual([]);
    const rain = newCombat(['catchTheSky', 'defend']);
    rain.weather.current = 'rain';
    play(rain, 'catchTheSky');
    expect(rain.cauldron).toEqual(['water']);
  });
});

describe('brewing cards', () => {
  it('Catalyst makes the next brew work twice', () => {
    const s = newCombat(['catalyst', 'stir']);
    s.cauldron = ['fire', 'fire'];
    play(s, 'catalyst');
    expect(s.doubleNext).toBe(1);
    play(s, 'stir', 0); // Fireball, twice
    expect(dummy(s).hp).toBe(DUMMY_HP - 12 * 2);
    expect(s.doubleNext).toBe(0);
  });

  it('Boil Over empties the cauldron for 4 damage per element', () => {
    const s = newCombat(['boilOver', 'boilOver']);
    s.cauldron = ['fire', 'water', 'earth'];
    play(s, 'boilOver', 0);
    expect(dummy(s).hp).toBe(DUMMY_HP - 12);
    expect(s.cauldron).toEqual([]);
    const second = s.hand.find((c) => c.defId === 'boilOver');
    if (!second) throw new Error('no second Boil Over');
    expect(cannotPlayReason(s, second)).toBe('The cauldron is empty.');
  });

  it('Simmer blocks and brews, even with an empty cauldron', () => {
    const s = newCombat(['simmer', 'simmer']);
    play(s, 'simmer');
    expect(s.player.block).toBe(5);
    s.cauldron = ['earth', 'earth'];
    play(s, 'simmer'); // Stoneskin
    expect(s.player.block).toBe(5 + 5 + 12);
  });
});

describe('weather cards', () => {
  it('Weather Front brings the next weather now', () => {
    const s = newCombat(['weatherFront', 'defend']);
    const next = s.weather.forecast[0];
    if (!next) throw new Error('no forecast');
    play(s, 'weatherFront');
    expect(s.weather.current).toBe(skyWeather(next));
    expect(s.weather.nextChangeTurn).toBe(s.turn + getSkyCard(next).turns);
  });

  it('Cloudburst calls Rain and hits every enemy', () => {
    const s = newCombat(['cloudburst'], { enemies: ['trainingDummy', 'trainingDummy'] });
    play(s, 'cloudburst');
    expect(s.weather.current).toBe('rain');
    expect(dummy(s, 0).hp).toBe(DUMMY_HP - 7);
    expect(dummy(s, 1).hp).toBe(DUMMY_HP - 7);
  });
});
