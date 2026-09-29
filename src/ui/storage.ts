import { createGrimoire, type Grimoire } from '../core/grimoire';
import { parseGrimoire, parseRunSave, type RunSave } from '../core/save';
import { parseSettings, type Settings } from './settings';

/**
 * Device storage for saves. localStorage persists inside the Android app's
 * WebView and in browsers; it can be unavailable (private mode), so every call
 * is guarded and the game still works without saving.
 */
const RUN_KEY = 'stormbrew.run';
const GRIMOIRE_KEY = 'stormbrew.grimoire';
const SETTINGS_KEY = 'stormbrew.settings';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Saving is best-effort.
  }
}

export function loadRun(): RunSave | null {
  return parseRunSave(read(RUN_KEY));
}

export function saveRun(save: RunSave): void {
  write(RUN_KEY, JSON.stringify(save));
}

export function clearRun(): void {
  write(RUN_KEY, null);
}

export function loadGrimoire(): Grimoire {
  return parseGrimoire(read(GRIMOIRE_KEY)) ?? createGrimoire();
}

export function saveGrimoire(grimoire: Grimoire): void {
  write(GRIMOIRE_KEY, JSON.stringify(grimoire));
}

export function loadSettings(): Settings {
  return parseSettings(read(SETTINGS_KEY));
}

export function saveSettings(settings: Settings): void {
  write(SETTINGS_KEY, JSON.stringify(settings));
}
