import { en, type MessageKey } from './en';
import { ko } from './ko';

/**
 * Languages. Every player-facing text goes through t() (UI and messages) or
 * the helpers in ./content.ts (names and texts of cards, enemies…), so adding
 * a language means adding its files here. English is the default and the
 * fallback for anything missing.
 */
export type Lang = 'en' | 'ko';

export const LANGUAGES: readonly { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'ko', name: '한국어' },
];

export type { MessageKey };

const CATALOGS: Record<Lang, Record<MessageKey, string>> = { en, ko };

let current: Lang = 'en';

export function setLanguage(lang: Lang): void {
  current = lang;
}

export function getLanguage(): Lang {
  return current;
}

export function isLang(value: unknown): value is Lang {
  return LANGUAGES.some((l) => l.id === value);
}

export type Params = Record<string, string | number>;

/** A message in the current language, with its `{params}` filled in (see format). */
export function t(key: MessageKey, params: Params = {}): string {
  return format(CATALOGS[current][key] ?? en[key], params);
}

/**
 * Fills `{name}` with params.name. Placeholders without a value stay as they
 * are (card texts keep `{damage}` for the card renderer). For Korean,
 * `{name|이}` also adds the particle that fits the word: 이/가, 을/를, 은/는,
 * 과/와 or 으로/로.
 */
export function format(template: string, params: Params): string {
  return template.replace(/\{(\w+)(?:\|([^}]+))?\}/g, (whole, name: string, particle: string | undefined) => {
    const value = params[name];
    if (value === undefined) return whole;
    const text = String(value);
    return particle ? text + josa(text, particle) : text;
  });
}

const PARTICLES: Record<string, [withBatchim: string, without: string]> = {
  이: ['이', '가'],
  가: ['이', '가'],
  을: ['을', '를'],
  를: ['을', '를'],
  은: ['은', '는'],
  는: ['은', '는'],
  과: ['과', '와'],
  와: ['과', '와'],
  으로: ['으로', '로'],
  로: ['으로', '로'],
};

/** How digits are read in Korean, for the particle after a number: 영 일 이 삼 사 오 육 칠 팔 구. */
const DIGIT_BATCHIM = [true, true, false, true, false, false, true, true, true, false];
const DIGIT_RIEUL = [false, true, false, false, false, false, false, true, true, false];

/**
 * The Korean particle that fits after a word: it depends on whether the
 * word's last syllable ends in a consonant (받침). Emoji, spaces and
 * punctuation at the end are skipped.
 */
export function josa(word: string, particle: string): string {
  const pair = PARTICLES[particle];
  if (!pair) return particle;
  const sound = lastSound(word);
  if (pair[0] === '으로') return sound.batchim && !sound.rieul ? '으로' : '로';
  return sound.batchim ? pair[0] : pair[1];
}

function lastSound(word: string): { batchim: boolean; rieul: boolean } {
  for (const ch of [...word].reverse()) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0xac00 && code <= 0xd7a3) {
      const final = (code - 0xac00) % 28;
      return { batchim: final !== 0, rieul: final === 8 };
    }
    if (ch >= '0' && ch <= '9') {
      const digit = Number(ch);
      return { batchim: DIGIT_BATCHIM[digit] ?? false, rieul: DIGIT_RIEUL[digit] ?? false };
    }
    if (/[a-z]/i.test(ch)) return { batchim: false, rieul: false };
  }
  return { batchim: false, rieul: false };
}

/** Joins names into a list: "A and B" / "A, B". */
export function listOf(items: readonly string[]): string {
  return items.join(t('list.and'));
}
