import { it } from 'vitest';
import { MAP_FLOORS } from '../../src/core/map';
import { ACTS } from '../../src/data/acts';
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
  for (const act of ACTS) {
    const here = lost.filter((r) => r.act === act.number);
    const floors = Array.from({ length: MAP_FLOORS + 1 }, (_, f) => here.filter((r) => r.floor === f).length);
    lines.push(`Act ${act.number} defeats by floor (1-${MAP_FLOORS}, then boss): ${floors.join(' ')}  (${here.length} in all)`);
  }
  for (const act of ACTS) {
    const atBoss = runs.flatMap((r) => (r.hpAtBoss[act.number - 1] === undefined ? [] : [r.hpAtBoss[act.number - 1] as number]));
    lines.push(`Reached the Act ${act.number} boss: ${atBoss.length} (${pct(atBoss.length / runs.length)}), with ${fixed(avg(atBoss))} HP on average`);
  }
  const relics = new Map<string, RunStats[]>();
  for (const r of runs) for (const id of r.bossRelics) relics.set(id, [...(relics.get(id) ?? []), r]);
  lines.push(
    `Boss relics taken (runs won): ${[...relics].map(([id, list]) => `${id} ${list.length} (${pct(list.filter((r) => r.won).length / list.length)})`).join(', ')}`,
  );
  lines.push(
    `End of run: deck ${fixed(avg(runs.map((r) => r.deckSize)))} cards, ${fixed(avg(runs.map((r) => r.relics)))} relics, ${fixed(avg(runs.map((r) => r.gold)))} gold`,
  );

  const fights = runs.flatMap((r) => r.fights);
  // Bosses change the weather all the time, so they are left out of the weather numbers.
  const bosses = new Set(ACTS.flatMap((a) => a.encounters.boss.flat()));
  const regular = fights.filter((f) => !bosses.has(f.enemies));
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
  const actOf = (name: string) =>
    ACTS.find((a) => Object.values(a.encounters).some((tier: string[][]) => tier.some((g) => g.join('+') === name)))?.number ?? 0;
  lines.push('', 'Act  Encounter                          n   win   HP lost  turns');
  const sorted = [...byEncounter].sort(
    (a, b) => actOf(a[0]) - actOf(b[0]) || avg(b[1].map((f) => f.hpLost)) - avg(a[1].map((f) => f.hpLost)),
  );
  for (const [name, list] of sorted) {
    lines.push(
      `${String(actOf(name)).padStart(3)}  ${name.padEnd(32)} ${String(list.length).padStart(4)} ${pct(list.filter((f) => f.won).length / list.length).padStart(5)} ` +
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
