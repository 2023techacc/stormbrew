import { it } from 'vitest';
import { MAP_FLOORS } from '../../src/core/map';
import { autoplayRun } from '../helpers/autoplay';
import { smartRun, type FightStats, type RunStats } from '../helpers/smartplay';

/**
 * Balance report: plays many runs with the heuristic player and prints how
 * they went. Run it with `npm run balance` (it is not part of `npm test`).
 */
const RUNS = 200;

const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const fixed = (x: number) => x.toFixed(1);

function report(runs: RunStats[]): string {
  const lines: string[] = [];
  const won = runs.filter((r) => r.won);
  lines.push(`Runs: ${runs.length}, won: ${won.length} (${pct(won.length / runs.length)})`);
  const lost = runs.filter((r) => !r.won);
  const floors = Array.from({ length: MAP_FLOORS + 1 }, (_, f) => lost.filter((r) => r.floor === f).length);
  lines.push(`Defeats by floor (1-${MAP_FLOORS}, then boss): ${floors.join(' ')}`);
  const atBoss = runs.flatMap((r) => (r.hpAtBoss === undefined ? [] : [r.hpAtBoss]));
  lines.push(`Reached the boss: ${atBoss.length}, with ${fixed(avg(atBoss))} HP on average`);
  lines.push(
    `End of run: deck ${fixed(avg(runs.map((r) => r.deckSize)))} cards, ${fixed(avg(runs.map((r) => r.relics)))} relics, ${fixed(avg(runs.map((r) => r.gold)))} gold`,
  );

  const fights = runs.flatMap((r) => r.fights);
  // The boss changes the weather every round, so it is left out of the weather numbers.
  const regular = fights.filter((f) => f.enemies !== 'eyeOfTheStorm');
  lines.push(
    `Per fight: ${fixed(avg(fights.map((f) => f.turns)))} turns, ${fixed(avg(fights.map((f) => f.hpLost)))} HP lost, ` +
      `${fixed(avg(fights.map((f) => f.caught)))} elements caught, ${fixed(avg(fights.map((f) => f.spilled)))} spilled, ` +
      `${fixed(avg(fights.map((f) => f.brews)))} brews, ${fixed(avg(fights.map((f) => f.enemyBrews)))} enemy brews, ` +
      `${fixed(avg(fights.map((f) => f.potionsUsed)))} potions`,
    `Weather in fights before the boss: ${fixed(avg(regular.map((f) => f.turns)))} turns, ` +
      `${fixed(avg(regular.map((f) => f.weatherChanges)))} changes (${fixed(avg(regular.map((f) => f.scheduledChanges)))} on schedule), ` +
      `${fixed(avg(regular.map((f) => f.weathersSeen)))} different weathers seen`,
  );

  const byEncounter = new Map<string, FightStats[]>();
  for (const f of fights) byEncounter.set(f.enemies, [...(byEncounter.get(f.enemies) ?? []), f]);
  lines.push('', 'Encounter                          n   win   HP lost  turns');
  for (const [name, list] of [...byEncounter].sort((a, b) => avg(b[1].map((f) => f.hpLost)) - avg(a[1].map((f) => f.hpLost)))) {
    lines.push(
      `${name.padEnd(32)} ${String(list.length).padStart(4)} ${pct(list.filter((f) => f.won).length / list.length).padStart(5)} ` +
        `${fixed(avg(list.map((f) => f.hpLost))).padStart(8)} ${fixed(avg(list.map((f) => f.turns))).padStart(6)}`,
    );
  }
  return lines.join('\n');
}

it('balance report', () => {
  const runs = Array.from({ length: RUNS }, (_, i) => smartRun(i + 1).stats);
  // For comparison: a player who plays random cards and picks rewards at random.
  const random = Array.from({ length: RUNS }, (_, i) => autoplayRun(i + 1, { distill: true }));
  const randomWins = random.filter((r) => r.status === 'won').length;
  console.log(`\n${report(runs)}\n\nRandom player: won ${randomWins} of ${RUNS} runs.\n`);
}, 900_000);
