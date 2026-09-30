import { ENCOUNTERS, ENCOUNTERS_ACT2, ENCOUNTERS_ACT3, type Encounters } from './enemies';

/**
 * A run climbs three acts. Each has its own map, enemies, elites and boss;
 * beating an act's boss heals you fully and offers a boss relic.
 */
export interface ActDef {
  /** 1, 2 or 3. */
  number: number;
  name: string;
  encounters: Encounters;
}

export const ACTS: readonly ActDef[] = [
  { number: 1, name: 'The Mirelands', encounters: ENCOUNTERS },
  { number: 2, name: 'The Frostpeaks', encounters: ENCOUNTERS_ACT2 },
  { number: 3, name: 'The Sky Citadel', encounters: ENCOUNTERS_ACT3 },
];

export const LAST_ACT = ACTS.length;

export function getAct(number: number): ActDef {
  const act = ACTS[number - 1];
  if (!act) throw new Error(`Unknown act: ${number}`);
  return act;
}
