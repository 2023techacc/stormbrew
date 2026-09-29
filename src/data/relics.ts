export interface RelicDef {
  id: string;
  name: string;
  text: string;
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
};

export const STARTING_RELICS = ['copperCauldron'];

/** Relics that can be found (elites, shops). */
export const RELIC_POOL = Object.keys(RELICS).filter((id) => !STARTING_RELICS.includes(id));

export function getRelic(id: string): RelicDef {
  const relic = RELICS[id];
  if (!relic) throw new Error(`Unknown relic: ${id}`);
  return relic;
}
