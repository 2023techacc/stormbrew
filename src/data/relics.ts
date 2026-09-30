export interface RelicDef {
  id: string;
  name: string;
  text: string;
  /** A boss relic: only offered after an act's boss (see BOSS_RELIC_POOL). */
  boss?: boolean;
}

/** Relics are passive bonuses kept for the whole run. Their effects live in core/combat.ts and core/run.ts. */
export const RELICS: Record<string, RelicDef> = {
  copperCauldron: {
    id: 'copperCauldron',
    name: 'Copper Cauldron',
    text: 'Start each fight with a random base element in the cauldron.',
  },
  barometer: { id: 'barometer', name: 'Barometer', text: 'The forecast shows the next two weathers.' },
  weathervane: { id: 'weathervane', name: 'Weathervane', text: 'Whenever the weather changes, gain 3 Block.' },
  ironCauldron: { id: 'ironCauldron', name: 'Iron Cauldron', text: 'Your cauldron has 4 slots.' },
  rainBarrel: { id: 'rainBarrel', name: 'Rain Barrel', text: 'In Rain, gain 1 extra energy each turn.' },
  snowGlobe: { id: 'snowGlobe', name: 'Snow Globe', text: 'In Snow, gain 3 Block at the start of your turn.' },
  lightningRod: { id: 'lightningRod', name: 'Lightning Rod', text: 'Storm lightning never hits you.' },
  sunStone: { id: 'sunStone', name: 'Sun Stone', text: 'Heatwave never gives you Burn.' },
  healingHerb: { id: 'healingHerb', name: 'Healing Herb', text: 'Heal 6 HP after each fight you win.' },
  luckyCoin: { id: 'luckyCoin', name: 'Lucky Coin', text: 'Gain 10 extra gold from each fight.' },
  alembic: { id: 'alembic', name: 'Alembic', text: 'Sludge becomes a random brew of two base elements.' },
  umbrella: { id: 'umbrella', name: 'Umbrella', text: 'Under cover, gain 4 Block at the start of your turn.' },
  windChime: { id: 'windChime', name: 'Wind Chime', text: 'Whenever the weather changes, draw a card.' },
  dewcatcher: {
    id: 'dewcatcher',
    name: 'Dewcatcher',
    text: 'Whenever the weather drops an element into your cauldron, gain 2 Block.',
  },
  cloudSeed: { id: 'cloudSeed', name: 'Cloud Seed', text: 'Fights start in a weather from your sky instead of Clear.' },
  emberCharm: { id: 'emberCharm', name: 'Ember Charm', text: 'Whenever you apply Burn, apply 1 more.' },
  frostCharm: { id: 'frostCharm', name: 'Frost Charm', text: 'Whenever you apply Weak, apply 1 more.' },
  kiln: { id: 'kiln', name: 'Kiln', text: 'In a Heatwave, gain 1 extra energy each turn.' },
  sunlitLantern: { id: 'sunlitLantern', name: 'Sunlit Lantern', text: 'In Clear skies, draw 1 extra card each turn.' },
  beltPouch: { id: 'beltPouch', name: 'Belt Pouch', text: 'Carry 1 more potion.' },
  heartyStew: { id: 'heartyStew', name: 'Hearty Stew', text: 'When you get it, gain 10 max HP.' },
  mastersNotes: {
    id: 'mastersNotes',
    name: "Master's Notes",
    text: 'Whenever you brew a three-element recipe, gain 1 energy.',
  },
  goldenScale: { id: 'goldenScale', name: 'Golden Scale', text: 'Shops are 20% cheaper.' },

  // Boss relics: after an act's boss you pick one of three. Strong, and the energy ones have a catch.
  stormVow: {
    id: 'stormVow',
    name: 'Storm Vow',
    text: 'Gain 1 extra energy each turn. You can never take cover.',
    boss: true,
  },
  skyAnchor: {
    id: 'skyAnchor',
    name: 'Sky Anchor',
    text: 'Gain 1 extra energy each turn. The weather no longer changes on its own.',
    boss: true,
  },
  philosophersStone: {
    id: 'philosophersStone',
    name: "Philosopher's Stone",
    text: 'Gain 1 extra energy each turn. Your cauldron has 1 slot less.',
    boss: true,
  },
  grandGrimoire: { id: 'grandGrimoire', name: 'Grand Grimoire', text: 'Whenever you brew, draw a card.', boss: true },
  bottomlessFlask: {
    id: 'bottomlessFlask',
    name: 'Bottomless Flask',
    text: 'Carry 2 more potions. Start each fight with a random potion.',
    boss: true,
  },
  thunderDrum: {
    id: 'thunderDrum',
    name: 'Thunder Drum',
    text: 'Storm lightning never hits you, and strikes twice each round.',
    boss: true,
  },
};

export const STARTING_RELICS = ['copperCauldron'];

/** Relics that can be found (elites, shops, events). */
export const RELIC_POOL = Object.keys(RELICS).filter((id) => !STARTING_RELICS.includes(id) && !RELICS[id]?.boss);

/** Relics offered after an act's boss. */
export const BOSS_RELIC_POOL = Object.keys(RELICS).filter((id) => RELICS[id]?.boss);

export function getRelic(id: string): RelicDef {
  const relic = RELICS[id];
  if (!relic) throw new Error(`Unknown relic: ${id}`);
  return relic;
}
