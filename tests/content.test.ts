import { describe, expect, it } from 'vitest';
import { createCombat, endTurn, playCard, playerAttackDamage, type CombatSetup } from '../src/core/combat';
import { SANDBOX_ENEMIES, createSandbox, sandboxAddCard, sandboxRefillEnergy, sandboxSetWeather } from '../src/core/sandbox';
import type { CombatState } from '../src/core/types';
import { CARDS, REWARD_POOL, STARTER_DECK } from '../src/data/cards';
import { ENCOUNTERS, ENEMIES } from '../src/data/enemies';

const newCombat = (deck: string[], overrides: Partial<CombatSetup> = {}): CombatState =>
  createCombat({ seed: 1, deck, enemies: ['cinderImp'], playerHp: 75, playerMaxHp: 75, ...overrides }).state;

const play = (s: CombatState, defId: string, target?: number) => {
  const card = s.hand.find((c) => c.defId === defId);
  if (!card) throw new Error(`no ${defId} in hand`);
  const result = playCard(s, card.uid, target);
  if (!result.ok) throw new Error(result.reason);
  return result.events;
};

describe('content', () => {
  it('every card id used anywhere exists', () => {
    for (const id of [...STARTER_DECK, ...REWARD_POOL]) expect(CARDS[id], id).toBeDefined();
  });

  it('every enemy in an encounter or the sandbox exists', () => {
    const ids = [...Object.values(ENCOUNTERS).flat(2), ...SANDBOX_ENEMIES];
    for (const id of ids) expect(ENEMIES[id], id).toBeDefined();
  });
});

describe('new enemies', () => {
  it("the Drizzle Slime's Spit makes the player Weak, which lowers their attacks and wears off", () => {
    const s = newCombat(['strike', 'strike', 'strike', 'strike', 'strike'], { enemies: ['drizzleSlime'] });
    endTurn(s); // Spit: 4 damage + 1 Weak
    expect(s.player.hp).toBe(75 - 4);
    expect(s.player.statuses.weak).toBe(1);
    expect(playerAttackDamage(s, 6, undefined)).toBe(4);
    play(s, 'strike', 0);
    expect(s.enemies[0]?.hp).toBe(26 - 4);
    endTurn(s); // Weak wears off at the end of the player's turn
    expect(s.player.statuses.weak).toBe(0);
    expect(playerAttackDamage(s, 6, undefined)).toBe(6);
  });

  it('the Frost Golem summons Snow, so its Block builds up', () => {
    const s = newCombat(['defend', 'defend', 'defend', 'defend', 'defend'], {
      enemies: ['frostGolem'],
      playerHp: 500,
      playerMaxHp: 500,
    });
    endTurn(s); // Frost Breath: Snow + 8 Block
    expect(s.weather.current).toBe('snow');
    endTurn(s); // Slam; Block stays in Snow
    endTurn(s); // Slam
    endTurn(s); // Frost Breath again: +8 more
    expect(s.enemies[0]?.block).toBe(16);
  });
});

describe('weather-control cards', () => {
  it('Barometric Shift swaps the current weather with the next one', () => {
    const s = newCombat(['barometricShift', 'defend', 'defend', 'defend', 'defend']);
    const next = s.weather.forecast[0];
    play(s, 'barometricShift');
    expect(s.weather.current).toBe(next);
    expect(s.weather.forecast[0]).toBe('clear');
    expect(s.weather.nextChangeTurn).toBe(s.turn + 3);
  });

  it('Hold the Sky restarts the countdown', () => {
    const s = newCombat(['holdTheSky']); // a one-card deck: it's in hand every turn
    endTurn(s);
    endTurn(s); // turn 3: the weather would change next turn
    expect(s.weather.nextChangeTurn).toBe(4);
    play(s, 'holdTheSky');
    expect(s.weather.nextChangeTurn).toBe(3 + 3);
    expect(s.player.block).toBe(4);
  });

  it('Call Lightning sets Storm and deals damage', () => {
    const s = newCombat(['callLightning', 'defend', 'defend', 'defend', 'defend']);
    play(s, 'callLightning', 0);
    expect(s.weather.current).toBe('storm');
    expect(s.enemies[0]?.hp).toBe(42 - 5);
  });

  it('Double Boil brews twice', () => {
    const s = newCombat(['doubleBoil', 'defend', 'defend', 'defend', 'defend']);
    s.cauldron = ['earth', 'earth', 'water'];
    const events = play(s, 'doubleBoil');
    // First Earth + Earth (Stoneskin), then the leftover Water alone makes Sludge.
    const brews = events.flatMap((e) => (e.type === 'brew' ? [e.recipeId] : []));
    expect(brews).toEqual(['stoneskin', 'sludge']);
    expect(s.cauldron).toEqual([]);
    expect(s.player.block).toBe(12 + 2);
  });
});

describe('sandbox', () => {
  it('starts against the chosen enemy with lots of HP', () => {
    const s = createSandbox('trainingDummy', 1);
    expect(s.enemies[0]?.defId).toBe('trainingDummy');
    expect(s.player.hp).toBe(999);
  });

  it('can add any card to the hand, up to the hand limit', () => {
    const s = createSandbox('trainingDummy', 1);
    expect(sandboxAddCard(s, 'thunderclap')).toBe(true);
    expect(s.hand.at(-1)?.defId).toBe('thunderclap');
    const uids = [...s.drawPile, ...s.hand, ...s.discardPile].map((c) => c.uid);
    expect(new Set(uids).size).toBe(uids.length);
    while (sandboxAddCard(s, 'strike'));
    expect(s.hand).toHaveLength(10);
  });

  it('can set the weather and refill energy', () => {
    const s = createSandbox('trainingDummy', 1);
    sandboxSetWeather(s, 'snow');
    expect(s.weather.current).toBe('snow');
    s.player.energy = 0;
    sandboxRefillEnergy(s);
    expect(s.player.energy).toBe(3);
  });

  it('the training dummy never attacks', () => {
    const s = createSandbox('trainingDummy', 1);
    s.weather.current = 'clear';
    s.weather.forecast = ['clear', 'clear'];
    for (let i = 0; i < 5; i++) {
      s.weather.current = 'clear';
      endTurn(s);
    }
    expect(s.player.hp).toBe(999);
  });
});
