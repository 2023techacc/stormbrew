import type { Grimoire } from './grimoire';
import type { RunScreen, RunState } from './run';
import type { CombatState } from './types';

/** Bump when the saved shape changes; older saves are upgraded (see upgradeSave) or ignored. */
export const SAVE_VERSION = 6;

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

/**
 * Brings an older save up to date, so updating the game doesn't lose a run in
 * progress. Version 4 runs were all in Act 1; version 5 fights had no Lasting
 * cards.
 */
function upgradeSave(data: Record<string, unknown>): void {
  if (data.version === 4 && data.run && typeof data.run === 'object') {
    (data.run as Partial<RunState>).act = 1;
    data.version = 5;
  }
  if (data.version === 5) {
    if (data.combat && typeof data.combat === 'object') (data.combat as Partial<CombatState>).lasting ??= {};
    data.version = 6;
  }
}

/** Parses a saved run; returns null for missing, corrupt, too old or finished saves. */
export function parseRunSave(text: string | null): RunSave | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as Record<string, unknown> | null;
    if (raw && typeof raw === 'object') upgradeSave(raw);
    const data = raw as Partial<RunSave> | null;
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
