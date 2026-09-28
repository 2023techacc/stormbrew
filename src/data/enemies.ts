import type { EnemyDef } from '../core/types';

export const ENEMIES: Record<string, EnemyDef> = {
  cinderImp: {
    id: 'cinderImp',
    name: 'Cinder Imp',
    maxHp: 42,
    moves: [
      { name: 'Claw', damage: 7, element: 'fire' },
      { name: 'Smolder', damage: 4, element: 'fire', block: 6 },
      { name: 'Flare', damage: 12, element: 'fire' },
    ],
    weathered: ['heatwave'],
  },
  stormCaller: {
    id: 'stormCaller',
    name: 'Storm Caller',
    maxHp: 40,
    moves: [
      { name: 'Call the Storm', weather: 'storm', block: 6 },
      { name: 'Zap', damage: 6, element: 'spark' },
      { name: 'Zap', damage: 6, element: 'spark' },
    ],
    weathered: ['storm'],
  },
};

/** Groups of enemies that can appear together in one fight. */
export const ENCOUNTERS: string[][] = [['cinderImp'], ['stormCaller']];

export function getEnemy(id: string): EnemyDef {
  const enemy = ENEMIES[id];
  if (!enemy) throw new Error(`Unknown enemy: ${id}`);
  return enemy;
}
