import type { EnemyDef } from '../core/types';

export const ENEMIES: Record<string, EnemyDef> = {
  cinderImp: {
    id: 'cinderImp',
    name: 'Cinder Imp',
    maxHp: 46,
    moves: [
      { name: 'Claw', damage: 10, element: 'fire' },
      { name: 'Smolder', damage: 6, element: 'fire', block: 7 },
      { name: 'Flare', damage: 15, element: 'fire' },
    ],
    weathered: ['heatwave'],
  },
  stormCaller: {
    id: 'stormCaller',
    name: 'Storm Caller',
    maxHp: 44,
    moves: [
      { name: 'Call the Storm', weather: 'storm', block: 7 },
      { name: 'Zap', damage: 10, element: 'spark' },
      // Adds two Storm cards to your sky for the rest of the fight.
      { name: 'Gather Clouds', damage: 7, element: 'spark', addSky: ['storm', 'storm'] },
    ],
    weathered: ['storm'],
  },
  drizzleSlime: {
    id: 'drizzleSlime',
    name: 'Drizzle Slime',
    maxHp: 30,
    moves: [
      { name: 'Spit', damage: 5, element: 'water', status: { status: 'weak', amount: 1 } },
      { name: 'Wobble', block: 6 },
      { name: 'Splash', damage: 9, element: 'water' },
    ],
    // Hides in puddles: the weather never reaches it.
    sheltered: true,
  },
  frostGolem: {
    id: 'frostGolem',
    name: 'Frost Golem',
    maxHp: 64,
    moves: [
      // It used to call Snow, but Snow kept the player's Block too, so it could never hurt anyone.
      { name: 'Frost Armor', block: 10 },
      { name: 'Slam', damage: 15 },
      { name: 'Slam', damage: 15 },
    ],
    // Brews Permafrost (15 Block), then Ice Lance (at you), every other turn.
    cauldron: { size: 2, gathers: ['earth', 'frost', 'frost', 'water'] },
  },
  mireWitch: {
    id: 'mireWitch',
    name: 'Mire Witch',
    maxHp: 40,
    moves: [
      { name: 'Hex', damage: 8, status: { status: 'weak', amount: 1 } },
      { name: 'Ward', block: 9 },
    ],
    // Brews Fireball, then Tonic, and so on.
    cauldron: { size: 2, gathers: ['fire', 'fire', 'water', 'water'] },
  },
  skyHawk: {
    id: 'skyHawk',
    name: 'Sky Hawk',
    maxHp: 34,
    moves: [
      { name: 'Circle', block: 6 },
      // A hunter: dives hardest at a player out in the open.
      { name: 'Dive', damage: 9, exposedBonus: 7 },
      { name: 'Talon', damage: 12 },
    ],
  },
  bogToad: {
    id: 'bogToad',
    name: 'Bog Toad',
    maxHp: 44,
    moves: [
      { name: 'Croak', weather: 'rain', block: 6 },
      { name: 'Tongue', damage: 8, stealElement: true },
      { name: 'Belly Flop', damage: 13, attuned: { weather: 'rain', damage: 4 } },
    ],
    // Brews Mud (Block for itself, Weak for you) every other turn.
    cauldron: { size: 2, gathers: ['water', 'earth'] },
  },
  sparkWisp: {
    id: 'sparkWisp',
    name: 'Spark Wisp',
    maxHp: 24,
    moves: [
      { name: 'Flicker', damage: 7, element: 'spark' },
      { name: 'Hover', block: 5 },
    ],
    weathered: ['storm'],
    // Brews Ball Lightning every other turn.
    cauldron: { size: 2, gathers: ['spark', 'air'] },
  },
  rainmaker: {
    id: 'rainmaker',
    name: 'Rainmaker',
    maxHp: 40,
    moves: [
      // Shuffles a Monsoon (5 turns of Rain) into your sky.
      { name: 'Seed the Clouds', block: 4, addSky: ['monsoon'] },
      { name: 'Soak', damage: 10, element: 'water', status: { status: 'weak', amount: 1 } },
      { name: 'Deluge', weather: 'rain', damage: 12, element: 'water', attuned: { weather: 'rain', block: 6 } },
    ],
  },
  snowWolf: {
    id: 'snowWolf',
    name: 'Snow Wolf',
    maxHp: 50,
    moves: [
      { name: 'Stalk', block: 6 },
      // Hunts best in Snow: pounces harder there.
      { name: 'Pounce', damage: 14, attuned: { weather: 'snow', damage: 6 } },
      { name: 'Bite', damage: 10, status: { status: 'weak', amount: 1 } },
    ],
  },

  // Elites: each one tests a different part of the game.
  /** Exposure: calls storms and dives at a player out in the open. */
  stormRoc: {
    id: 'stormRoc',
    name: 'Storm Roc',
    maxHp: 110,
    moves: [
      { name: 'Thunder Wings', weather: 'storm', block: 14 },
      { name: 'Dive', damage: 18, exposedBonus: 10 },
      { name: 'Gale', damage: 14, addSky: ['squall', 'squall'] },
    ],
    weathered: ['storm'],
  },
  /** Brewing: a three-slot cauldron, and it steals from yours. */
  cauldronCrone: {
    id: 'cauldronCrone',
    name: 'Cauldron Crone',
    maxHp: 95,
    moves: [
      { name: 'Hex', damage: 14, status: { status: 'weak', amount: 1 } },
      { name: 'Snatch', damage: 12, stealElement: true },
      { name: 'Stir the Pot', damage: 6, block: 12 },
    ],
    // Heat Haze (Heatwave and fire at you), then Downpour (Rain; it heals and shields itself).
    cauldron: { size: 3, gathers: ['fire', 'fire', 'air', 'water', 'water', 'air'] },
  },
  /** The sky: fills your sky with Heat Domes and burns hottest in a Heatwave. */
  cinderDrake: {
    id: 'cinderDrake',
    name: 'Cinder Drake',
    maxHp: 100,
    moves: [
      { name: 'Kindle the Sky', weather: 'heatwave', block: 12, addSky: ['heatDome'] },
      { name: 'Fire Breath', damage: 12, element: 'fire', attuned: { weather: 'heatwave', damage: 4 } },
      { name: 'Tail Swipe', damage: 10, status: { status: 'burn', amount: 2 } },
    ],
    weathered: ['heatwave'],
  },

  /** Act 1 boss: changes the weather every round in a fixed cycle. */
  eyeOfTheStorm: {
    id: 'eyeOfTheStorm',
    name: 'Eye of the Storm',
    maxHp: 170,
    moves: [
      { name: 'Gale', weather: 'rain', damage: 14, element: 'water' },
      { name: 'Thunderhead', weather: 'storm', block: 16 },
      { name: 'Scorch', weather: 'heatwave', damage: 18, element: 'fire' },
      { name: 'Whiteout', weather: 'snow', damage: 11, block: 12 },
    ],
    weathered: ['storm', 'heatwave'],
    // Only fills with what it steals from you, then brews it against you.
    cauldron: { size: 3, gathers: [] },
    // Below half HP it also steals the newest element from your cauldron.
    phase2: {
      below: 0.5,
      moves: [
        { name: 'Siphon', weather: 'storm', damage: 15, element: 'spark', stealElement: true },
        { name: 'Scorch', weather: 'heatwave', damage: 20, element: 'fire' },
        { name: 'Drain', weather: 'rain', damage: 13, element: 'water', stealElement: true, status: { status: 'weak', amount: 1 } },
        { name: 'Whiteout', weather: 'snow', damage: 12, block: 14 },
      ],
    },
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
  easy: [
    ['cinderImp'],
    ['stormCaller'],
    ['mireWitch'],
    ['skyHawk'],
    ['bogToad'],
    ['rainmaker'],
    ['drizzleSlime', 'drizzleSlime'],
  ],
  hard: [
    ['frostGolem'],
    ['snowWolf'],
    ['sparkWisp', 'sparkWisp'],
    ['cinderImp', 'drizzleSlime'],
    ['stormCaller', 'drizzleSlime'],
    ['mireWitch', 'drizzleSlime'],
    ['skyHawk', 'sparkWisp'],
    ['bogToad', 'drizzleSlime'],
    ['rainmaker', 'cinderImp'],
    ['snowWolf', 'drizzleSlime'],
  ],
  elite: [['stormRoc'], ['cauldronCrone'], ['cinderDrake']],
  boss: [['eyeOfTheStorm']],
} satisfies Record<string, string[][]>;

export function getEnemy(id: string): EnemyDef {
  const enemy = ENEMIES[id];
  if (!enemy) throw new Error(`Unknown enemy: ${id}`);
  return enemy;
}
