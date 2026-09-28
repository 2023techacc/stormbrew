import type { EnemyDef } from '../core/types';

export const ENEMIES: Record<string, EnemyDef> = {
  cinderImp: {
    id: 'cinderImp',
    name: 'Cinder Imp',
    maxHp: 42,
    moves: [
      { name: 'Claw', damage: 7 },
      { name: 'Smolder', damage: 4, block: 6 },
      { name: 'Flare', damage: 12 },
    ],
  },
};

export function getEnemy(id: string): EnemyDef {
  const enemy = ENEMIES[id];
  if (!enemy) throw new Error(`Unknown enemy: ${id}`);
  return enemy;
}
