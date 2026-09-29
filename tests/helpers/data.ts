import type { EnemyMove } from '../../src/core/types';
import { getEnemy } from '../../src/data/enemies';

/**
 * Enemy numbers for tests, read from the data, so balance changes don't break
 * tests that are about rules rather than numbers.
 */
export const enemyHp = (enemyId: string): number => getEnemy(enemyId).maxHp;

/** One of an enemy's moves, by name. */
export function enemyMove(enemyId: string, name: string): EnemyMove & { damage: number; block: number } {
  const def = getEnemy(enemyId);
  const move = [...def.moves, ...(def.phase2?.moves ?? [])].find((m) => m.name === name);
  if (!move) throw new Error(`${enemyId} has no move ${name}`);
  return { ...move, damage: move.damage ?? 0, block: move.block ?? 0 };
}
