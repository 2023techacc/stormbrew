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
  drizzleSlime: {
    id: 'drizzleSlime',
    name: 'Drizzle Slime',
    maxHp: 26,
    moves: [
      { name: 'Spit', damage: 4, element: 'water', status: { status: 'weak', amount: 1 } },
      { name: 'Wobble', block: 5 },
      { name: 'Splash', damage: 8, element: 'water' },
    ],
  },
  frostGolem: {
    id: 'frostGolem',
    name: 'Frost Golem',
    maxHp: 55,
    moves: [
      { name: 'Frost Breath', weather: 'snow', block: 8 },
      { name: 'Slam', damage: 11 },
      { name: 'Slam', damage: 11 },
    ],
  },
  /** Sandbox only: never attacks and is hard to kill. */
  trainingDummy: {
    id: 'trainingDummy',
    name: 'Training Dummy',
    maxHp: 999,
    moves: [{ name: 'Wait' }],
  },
};

/** Groups of enemies that can appear together in one fight, by difficulty. */
export const ENCOUNTERS = {
  easy: [['cinderImp'], ['drizzleSlime'], ['stormCaller']],
  hard: [
    ['frostGolem'],
    ['drizzleSlime', 'drizzleSlime'],
    ['cinderImp', 'drizzleSlime'],
    ['stormCaller', 'drizzleSlime'],
  ],
} satisfies Record<string, string[][]>;

export function getEnemy(id: string): EnemyDef {
  const enemy = ENEMIES[id];
  if (!enemy) throw new Error(`Unknown enemy: ${id}`);
  return enemy;
}
