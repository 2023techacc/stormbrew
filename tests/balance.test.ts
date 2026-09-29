import { describe, expect, it } from 'vitest';
import { autoplayRun } from './helpers/autoplay';
import { smartRun } from './helpers/smartplay';

/**
 * A guard against big balance slips. The full report is `npm run balance`
 * (200 runs, per-encounter numbers); this plays a few runs and checks the
 * game is neither a pushover nor impossible for a good player, and that
 * playing well matters.
 */
describe('balance', () => {
  it('a strong player wins some runs but not all, and random play almost never wins', () => {
    const runs = 20;
    const smartWins = Array.from({ length: runs }, (_, i) => smartRun(i + 1).stats.won).filter(Boolean).length;
    const randomWins = Array.from({ length: runs }, (_, i) => autoplayRun(i + 1, { distill: true }).status === 'won').filter(
      Boolean,
    ).length;
    console.log(`balance: the heuristic player won ${smartWins}/${runs}, random play won ${randomWins}/${runs}`);
    expect(smartWins).toBeGreaterThanOrEqual(runs * 0.3);
    expect(smartWins).toBeLessThanOrEqual(runs * 0.9);
    expect(randomWins).toBeLessThanOrEqual(runs * 0.1);
  }, 120_000);
});
