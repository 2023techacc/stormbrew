import { isLang, type Lang } from '../i18n';

/** Player preferences, kept on the device separately from saved runs. */
export interface Settings {
  language: Lang;
  sound: boolean;
  vibration: boolean;
  /** Weather particles and the livelier animations. */
  effects: boolean;
}

export const DEFAULT_SETTINGS: Settings = { language: 'en', sound: true, vibration: true, effects: true };

/** The on/off settings, in the order the Settings screen shows them. */
export const TOGGLES = ['sound', 'vibration', 'effects'] as const;
export type Toggle = (typeof TOGGLES)[number];

/** Reads saved settings; anything missing or unreadable gets its default. */
type SavedSettings = Partial<Record<keyof Settings, unknown>> | null;

export function parseSettings(text: string | null): Settings {
  let data: SavedSettings = null;
  try {
    data = text ? (JSON.parse(text) as SavedSettings) : null;
  } catch {
    data = null;
  }
  const flag = (key: Toggle) => (typeof data?.[key] === 'boolean' ? (data[key] as boolean) : DEFAULT_SETTINGS[key]);
  return {
    language: isLang(data?.language) ? data.language : DEFAULT_SETTINGS.language,
    sound: flag('sound'),
    vibration: flag('vibration'),
    effects: flag('effects'),
  };
}
