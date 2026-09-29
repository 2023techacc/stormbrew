import type { Grimoire } from './grimoire';
import type { RunScreen, RunState } from './run';
import type { CombatState } from './types';

/** Bump when the saved shape changes incompatibly; older saves are then ignored. */
export const SAVE_VERSION = 4;

/** Everything needed to resume a run exactly where it was left, even mid-fight. */
export interface RunSave {
  version: typeof SAVE_VERSION;
  run: RunState;
  screen: RunScreen;
  /** The fight in progress, when screen is 'combat'. */
  combat?: CombatState;
}

export function makeRunSave(run: RunState, screen: RunScreen, combat?: CombatState): RunSave {
  return combat ? { version: SAVE_VERSION, run, screen, combat } : { version: SAVE_VERSION, run, screen };
}

/** Parses a saved run; returns null for missing, corrupt, outdated or finished saves. */
export function parseRunSave(text: string | null): RunSave | null {
  if (!text) return null;
  try {
    const data = JSON.parse(text) as Partial<RunSave> | null;
    if (!data || data.version !== SAVE_VERSION || !data.run || !data.screen) return null;
    if (data.run.status !== 'playing') return null;
    if (data.screen.name === 'combat' && !data.combat) return null;
    return data as RunSave;
  } catch {
    return null;
  }
}

export function parseGrimoire(text: string | null): Grimoire | null {
  if (!text) return null;
  try {
    const data = JSON.parse(text) as Partial<Grimoire> | null;
    if (!data || !Array.isArray(data.discovered)) return null;
    return { discovered: data.discovered.filter((id): id is string => typeof id === 'string') };
  } catch {
    return null;
  }
}
