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
    maxHp: 100,
    moves: [
      { name: 'Thunder Wings', weather: 'storm', block: 14 },
      { name: 'Dive', damage: 16, exposedBonus: 10 },
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
    maxHp: 150,
    moves: [
      { name: 'Gale', weather: 'rain', damage: 12, element: 'water' },
      { name: 'Thunderhead', weather: 'storm', block: 16 },
      { name: 'Scorch', weather: 'heatwave', damage: 16, element: 'fire' },
      { name: 'Whiteout', weather: 'snow', damage: 11, block: 12 },
    ],
    weathered: ['storm', 'heatwave'],
    // Only fills with what it steals from you, then brews it against you.
    cauldron: { size: 3, gathers: [] },
    // Below half HP it also steals the newest element from your cauldron.
    phase2: {
      below: 0.5,
      moves: [
        { name: 'Siphon', weather: 'storm', damage: 13, element: 'spark', stealElement: true },
        { name: 'Scorch', weather: 'heatwave', damage: 18, element: 'fire' },
        { name: 'Drain', weather: 'rain', damage: 12, element: 'water', stealElement: true, status: { status: 'weak', amount: 1 } },
        { name: 'Whiteout', weather: 'snow', damage: 12, block: 14 },
      ],
    },
  },
  // ---------- Act 2: the Frostpeaks ----------
  // Snow keeps everyone's Block, but here the cold enemies shatter yours: in Snow their walls
  // pile up while yours crack. Change the weather to break theirs.

  /** Comes in pairs; bites twice, harder at a player out in the open. */
  iceBat: {
    id: 'iceBat',
    name: 'Ice Bat',
    maxHp: 26,
    moves: [
      { name: 'Swoop', damage: 4, hits: 2, exposedBonus: 2 },
      { name: 'Screech', block: 5, status: { status: 'weak', amount: 1 } },
    ],
    weathered: ['snow'],
  },
  frostMammoth: {
    id: 'frostMammoth',
    name: 'Frost Mammoth',
    maxHp: 72,
    moves: [
      { name: 'Trumpet', weather: 'snow', block: 14 },
      // Shattering your Block is the real threat, so the hit itself is lighter.
      { name: 'Trample', damage: 11, shatter: true, attuned: { weather: 'snow', damage: 2 } },
      { name: 'Tusk Sweep', damage: 10, status: { status: 'weak', amount: 1 } },
    ],
    weathered: ['snow'],
  },
  sleetSprite: {
    id: 'sleetSprite',
    name: 'Sleet Sprite',
    maxHp: 44,
    moves: [
      { name: 'Chill', damage: 8, element: 'frost' },
      { name: 'Veil', block: 10 },
    ],
    // Brews Ice Lance at you every other turn.
    cauldron: { size: 2, gathers: ['frost', 'water'] },
  },
  thunderRam: {
    id: 'thunderRam',
    name: 'Thunder Ram',
    maxHp: 72,
    moves: [
      { name: 'Lower Horns', block: 12 },
      { name: 'Charge', damage: 18, attuned: { weather: 'storm', damage: 6 } },
      { name: 'Headbutt', damage: 10, status: { status: 'weak', amount: 1 } },
    ],
    weathered: ['storm'],
  },
  stormEel: {
    id: 'stormEel',
    name: 'Storm Eel',
    maxHp: 58,
    moves: [
      { name: 'Jolt', damage: 5, hits: 2, element: 'spark' },
      // Stirs up the sky: a Storm joins your sky for this fight.
      { name: 'Churn', block: 10, addSky: ['storm'] },
      { name: 'Discharge', damage: 12, element: 'spark', attuned: { weather: 'storm', damage: 6 } },
    ],
    weathered: ['storm'],
  },

  /** Walls itself in Snow: its Block keeps piling up until the weather turns, and it shatters yours. */
  glacierTitan: {
    id: 'glacierTitan',
    name: 'Glacier Titan',
    maxHp: 140,
    moves: [
      { name: 'Deep Cold', weather: 'snow', block: 14 },
      { name: 'Crush', damage: 13, shatter: true },
      { name: 'Frost Breath', damage: 11, element: 'frost', status: { status: 'weak', amount: 2 } },
    ],
    weathered: ['snow'],
  },
  /** A cold brewer: Blizzard, Ice Lance at you, Permafrost; and it steals from your cauldron. */
  rimeWitch: {
    id: 'rimeWitch',
    name: 'Rime Witch',
    maxHp: 120,
    moves: [
      { name: 'Hex', damage: 12, status: { status: 'weak', amount: 1 } },
      { name: 'Snatch', damage: 11, stealElement: true },
      { name: 'Ice Shards', damage: 4, hits: 3, shatter: true },
    ],
    cauldron: { size: 3, gathers: ['frost', 'air', 'frost', 'water', 'frost', 'earth'] },
  },
  /** A hunter of the storm: plunges at a player out in the open. */
  thunderOwl: {
    id: 'thunderOwl',
    name: 'Thunder Owl',
    maxHp: 165,
    moves: [
      { name: 'Night Sight', block: 12, addSky: ['squall'] },
      { name: 'Plunge', damage: 17, exposedBonus: 10, attuned: { weather: 'storm', damage: 4 } },
      { name: 'Talon Flurry', damage: 6, hits: 3 },
    ],
    weathered: ['storm'],
  },

  /** Act 2 boss: Snow is its fortress, and it shatters yours. Below half HP it turns savage. */
  frostWyrm: {
    id: 'frostWyrm',
    name: 'Frost Wyrm',
    maxHp: 210,
    moves: [
      { name: 'Frozen Roar', weather: 'snow', block: 14 },
      { name: 'Ice Breath', damage: 9, hits: 2, element: 'frost' },
      { name: 'Tail Sweep', damage: 13, shatter: true, status: { status: 'weak', amount: 1 } },
      { name: 'Hibernate', block: 12, heal: 8 },
    ],
    weathered: ['snow'],
    phase2: {
      below: 0.5,
      moves: [
        { name: 'Blizzard Wings', weather: 'snow', damage: 7, hits: 3, element: 'frost' },
        { name: 'Glacial Bite', damage: 19, shatter: true },
        { name: 'Permafrost Hide', block: 18 },
      ],
    },
  },

  // ---------- Act 3: the Sky Citadel ----------
  // Heat, lightning and many-hit attacks, up to the heart of the storm itself.

  lavaLizard: {
    id: 'lavaLizard',
    name: 'Lava Lizard',
    maxHp: 76,
    moves: [
      { name: 'Scorch', damage: 8, element: 'fire', status: { status: 'burn', amount: 1 } },
      { name: 'Bask', weather: 'heatwave', block: 12 },
      { name: 'Magma Spit', damage: 14, element: 'fire' },
    ],
    weathered: ['heatwave'],
  },
  stormElemental: {
    id: 'stormElemental',
    name: 'Storm Elemental',
    maxHp: 90,
    moves: [
      { name: 'Whirl', damage: 4, hits: 3 },
      // Two short Storms join your sky for this fight.
      { name: 'Cyclone', block: 14, addSky: ['squall', 'squall'] },
      { name: 'Lightning Lash', damage: 16, element: 'spark', attuned: { weather: 'storm', damage: 6 } },
    ],
    weathered: ['storm'],
  },
  brassAutomaton: {
    id: 'brassAutomaton',
    name: 'Brass Automaton',
    maxHp: 100,
    moves: [
      { name: 'Piston', damage: 12 },
      { name: 'Plating', block: 16 },
    ],
    // Brews Plasma Bolt at you every other turn.
    cauldron: { size: 2, gathers: ['spark', 'fire'] },
  },
  emberWraith: {
    id: 'emberWraith',
    name: 'Ember Wraith',
    maxHp: 60,
    moves: [
      { name: 'Haunt', damage: 9, status: { status: 'weak', amount: 1 } },
      { name: 'Soul Fire', block: 8, status: { status: 'burn', amount: 2 } },
      { name: 'Wail', damage: 5, hits: 2 },
    ],
    // A ghost: the weather passes right through it.
    sheltered: true,
  },
  /** A hunter: strikes from above at a player out in the open. */
  cloudShark: {
    id: 'cloudShark',
    name: 'Cloud Shark',
    maxHp: 80,
    moves: [
      { name: 'Circle', block: 12 },
      { name: 'Strike from Above', damage: 14, exposedBonus: 10 },
      { name: 'Frenzy', damage: 4, hits: 3 },
    ],
  },

  /** Burns hottest in a Heatwave, and fills your sky with Heat Domes. */
  magmaColossus: {
    id: 'magmaColossus',
    name: 'Magma Colossus',
    maxHp: 215,
    moves: [
      { name: 'Eruption', weather: 'heatwave', damage: 10, element: 'fire', addSky: ['heatDome'] },
      { name: 'Obsidian Skin', block: 22 },
      { name: 'Lava Flow', damage: 18, element: 'fire', status: { status: 'burn', amount: 3 } },
    ],
    weathered: ['heatwave'],
  },
  tempestDjinn: {
    id: 'tempestDjinn',
    name: 'Tempest Djinn',
    maxHp: 200,
    moves: [
      { name: 'Summon Squall', weather: 'storm', block: 15 },
      { name: 'Thunderstrike', damage: 20, element: 'spark', attuned: { weather: 'storm', damage: 6 } },
      { name: 'Gust', damage: 6, hits: 3 },
    ],
    weathered: ['storm'],
  },
  /** Brews Thunderhead (Storm and lightning at you) and Heat Haze; steals and heals itself. */
  grandAlchemist: {
    id: 'grandAlchemist',
    name: 'Grand Alchemist',
    maxHp: 190,
    moves: [
      { name: 'Transmute', damage: 13, stealElement: true },
      { name: 'Elixir', block: 12, heal: 14 },
      { name: 'Acid Flask', damage: 17, status: { status: 'weak', amount: 2 } },
    ],
    cauldron: { size: 3, gathers: ['water', 'air', 'spark', 'fire', 'fire', 'air'] },
  },

  /** Final boss: every weather at once, many-hit lightning, and its own cauldron. */
  heartOfTheStorm: {
    id: 'heartOfTheStorm',
    name: 'Heart of the Storm',
    maxHp: 280,
    moves: [
      { name: 'Gathering Storm', weather: 'storm', block: 20, addSky: ['squall', 'squall'] },
      { name: 'Lightning Barrage', damage: 5, hits: 4, element: 'spark' },
      { name: 'Firestorm', weather: 'heatwave', damage: 16, element: 'fire', status: { status: 'burn', amount: 2 } },
      { name: 'Frozen Heart', weather: 'snow', block: 22, heal: 12 },
    ],
    weathered: ['storm', 'heatwave', 'snow'],
    // Plasma Bolt, Ball Lightning and Wildfire, all at you.
    cauldron: { size: 3, gathers: ['spark', 'fire', 'air'] },
    phase2: {
      below: 0.5,
      moves: [
        { name: 'Maelstrom', weather: 'storm', damage: 6, hits: 3, element: 'spark' },
        { name: 'Cataclysm', damage: 26 },
        { name: 'Eye Wall', block: 28, status: { status: 'weak', amount: 2 } },
        { name: 'Siphon', damage: 14, stealElement: true },
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

export interface Encounters {
  /** The first few floors of an act. */
  easy: string[][];
  hard: string[][];
  elite: string[][];
  boss: string[][];
}

/** Act 1: groups of enemies that can appear together in one fight, by difficulty. */
export const ENCOUNTERS: Encounters = {
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
};

export const ENCOUNTERS_ACT2: Encounters = {
  easy: [['iceBat', 'iceBat'], ['sleetSprite'], ['stormEel'], ['thunderRam']],
  hard: [
    ['frostMammoth'],
    ['thunderRam', 'iceBat'],
    ['sleetSprite', 'stormEel'],
    ['stormEel', 'iceBat'],
    ['sleetSprite', 'sleetSprite'],
  ],
  elite: [['glacierTitan'], ['rimeWitch'], ['thunderOwl']],
  boss: [['frostWyrm']],
};

export const ENCOUNTERS_ACT3: Encounters = {
  easy: [['lavaLizard'], ['stormElemental'], ['emberWraith'], ['cloudShark']],
  hard: [
    ['brassAutomaton'],
    ['lavaLizard', 'emberWraith'],
    ['stormElemental', 'cloudShark'],
    ['brassAutomaton', 'emberWraith'],
    ['cloudShark', 'lavaLizard'],
  ],
  elite: [['magmaColossus'], ['tempestDjinn'], ['grandAlchemist']],
  boss: [['heartOfTheStorm']],
};

export function getEnemy(id: string): EnemyDef {
  const enemy = ENEMIES[id];
  if (!enemy) throw new Error(`Unknown enemy: ${id}`);
  return enemy;
}
