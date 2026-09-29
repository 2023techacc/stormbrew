import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CombatEvent, CombatState, UnitRef } from '../src/core/types';
import { combatFeedback } from '../src/ui/feedback';
import { buzz } from '../src/ui/haptics';
import { playSfx } from '../src/ui/sound';

vi.mock('../src/ui/sound', () => ({ playSfx: vi.fn() }));
vi.mock('../src/ui/haptics', () => ({ buzz: vi.fn() }));

const playing = { status: 'playing' } as CombatState;
const won = { status: 'won' } as CombatState;
const lost = { status: 'lost' } as CombatState;
const player: UnitRef = { side: 'player' };
const enemy = (index: number): UnitRef => ({ side: 'enemy', index });
const hit = (amount: number, target: UnitRef, source?: 'burn' | 'lightning'): CombatEvent =>
  source ? { type: 'damage', target, amount, blocked: 0, source } : { type: 'damage', target, amount, blocked: 0 };

const sounds = () => vi.mocked(playSfx).mock.calls.map(([name]) => name);
const buzzes = () => vi.mocked(buzz).mock.calls.map(([kind]) => kind);

beforeEach(() => {
  vi.mocked(playSfx).mockClear();
  vi.mocked(buzz).mockClear();
});

describe('combat feedback', () => {
  it('plays a burst of hits a few times, spaced apart', () => {
    combatFeedback([0, 1, 0, 1, 0].map((i) => hit(5, enemy(i))), playing, true);
    expect(sounds()).toEqual(['hit', 'hit', 'hit']);
    const delays = vi.mocked(playSfx).mock.calls.map(([, delay]) => delay ?? 0);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(new Set(delays).size).toBe(3);
    expect(buzzes()).toEqual([]);
  });

  it('buzzes when you are hurt, harder for big hits', () => {
    combatFeedback([hit(4, player)], playing, true);
    expect(buzzes()).toEqual(['medium']);
    vi.mocked(buzz).mockClear();
    combatFeedback([hit(6, player), hit(6, player)], playing, true);
    expect(buzzes()).toEqual(['heavy']);
  });

  it('a fully blocked hit clinks instead of hurting', () => {
    combatFeedback([hit(0, player)], playing, true);
    expect(sounds()).toEqual(['block']);
    expect(buzzes()).toEqual([]);
  });

  it('lightning thunders, and shakes the phone when it strikes you', () => {
    combatFeedback([hit(5, enemy(0), 'lightning')], playing, true);
    expect(sounds()).toEqual(['thunder']);
    expect(buzzes()).toEqual([]);
    combatFeedback([hit(5, player, 'lightning')], playing, true);
    expect(buzzes()).toContain('heavy');
  });

  it('brewing bubbles and buzzes lightly', () => {
    combatFeedback([{ type: 'brew', recipeId: 'steam', used: ['fire', 'water'] }], playing, true);
    expect(sounds()).toEqual(['brew']);
    expect(buzzes()).toEqual(['light']);
  });

  it('celebrates (or mourns) only the moment the fight ends', () => {
    combatFeedback([hit(9, enemy(0))], won, true);
    expect(sounds()).toEqual(['hit', 'victory']);
    expect(buzzes()).toEqual(['success']);
    vi.mocked(playSfx).mockClear();
    combatFeedback([], won, false);
    expect(sounds()).toEqual([]);
    combatFeedback([hit(9, player)], lost, true);
    expect(sounds()).toEqual(['hurt', 'defeat']);
    expect(buzzes()).toContain('failure');
  });
});
