import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('keeps next() in [0, 1) and int() within bounds', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('shuffles without losing or duplicating items', () => {
    const rng = new Rng(123);
    const deck = ['strike', 'strike', 'defend', 'stir', 'gather-ember'];
    const shuffled = rng.shuffle(deck);
    expect([...shuffled].sort()).toEqual([...deck].sort());
    expect(deck).toEqual(['strike', 'strike', 'defend', 'stir', 'gather-ember']);
  });

  it('resumes the same sequence after saving and restoring state', () => {
    const rng = new Rng(99);
    rng.next();
    rng.next();
    const restored = Rng.fromState(rng.getState());
    for (let i = 0; i < 20; i++) expect(restored.next()).toBe(rng.next());
  });

  it('throws when picking from an empty array', () => {
    expect(() => new Rng(1).pick([])).toThrow();
  });
});
