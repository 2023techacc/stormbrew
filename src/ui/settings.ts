import { isLang, type Lang } from '../i18n';

/** Player preferences, kept on the device separately from saved runs. */
export interface Settings {
  language: Lang;
}

export const DEFAULT_SETTINGS: Settings = { language: 'en' };

/** Reads saved settings; anything missing or unreadable gets its default. */
export function parseSettings(text: string | null): Settings {
  if (!text) return { ...DEFAULT_SETTINGS };
  try {
    const data = JSON.parse(text) as Partial<Record<keyof Settings, unknown>> | null;
    return { language: isLang(data?.language) ? data.language : DEFAULT_SETTINGS.language };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
