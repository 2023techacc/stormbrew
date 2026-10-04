import { afterEach, describe, expect, it } from 'vitest';
import { createRun, buyCard } from '../src/core/run';
import { ACTS } from '../src/data/acts';
import { CARDS, getCard } from '../src/data/cards';
import { DISTILLED_CARDS, essenceId, flaskId } from '../src/data/distilled';
import { ENEMIES } from '../src/data/enemies';
import { EVENTS } from '../src/data/events';
import { RECIPES, SLUDGE } from '../src/data/recipes';
import { RELICS } from '../src/data/relics';
import { SKY_CARDS } from '../src/data/sky';
import { LANGUAGES, format, josa, langTag, listOf, setLanguage, t, type Lang, type MessageKey } from '../src/i18n';
import { CONTENT, cardName, cardText, enemyName, recipeName, skyText, weatherEffect } from '../src/i18n/content';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { ja } from '../src/i18n/ja';
import { ko } from '../src/i18n/ko';
import { zh } from '../src/i18n/zh';
import type { ContentTable } from '../src/i18n/tables';
import { parseSettings } from '../src/ui/settings';

afterEach(() => setLanguage('en'));

const params = (text: string) => [...text.matchAll(/\{(\w+)(?:\|[^}]+)?\}/g)].map((m) => m[1] ?? '').sort();

const CATALOGS: Record<Exclude<Lang, 'en'>, Record<MessageKey, string>> = { ko, ja, zh, es };
const TRANSLATIONS = Object.keys(CATALOGS) as Exclude<Lang, 'en'>[];

/** Messages that may leave out an English parameter (the clear sky's name is written out). */
const DROPPED: Partial<Record<MessageKey, string[]>> = { 'exposure.outClear': ['weather'] };

describe('languages', () => {
  it('each have a message catalog and a content table', () => {
    expect(LANGUAGES.map((l) => l.id).sort()).toEqual(['en', ...TRANSLATIONS].sort());
    for (const lang of TRANSLATIONS) expect(CONTENT[lang], lang).toBeDefined();
  });

  it('tag the page so it gets the right fonts', () => {
    expect(langTag('en')).toBe('en');
    expect(langTag('ko')).toBe('ko');
    expect(langTag('zh')).toBe('zh-CN');
  });
});

describe('messages', () => {
  it('fill in parameters and keep unknown placeholders for the card renderer', () => {
    expect(format('Deal {damage}. Draw {n}.', { n: 2 })).toBe('Deal {damage}. Draw 2.');
    expect(t('combat.turn', { turn: 3 })).toBe('Turn 3');
    setLanguage('ko');
    expect(t('combat.turn', { turn: 3 })).toBe('3턴');
    setLanguage('ja');
    expect(t('combat.turn', { turn: 3 })).toBe('3ターン目');
    setLanguage('zh');
    expect(t('combat.turn', { turn: 3 })).toBe('第3回合');
    setLanguage('es');
    expect(t('combat.turn', { turn: 3 })).toBe('Turno 3');
  });

  it.each(TRANSLATIONS)('in %s use the parameters the English ones have', (lang) => {
    for (const key of Object.keys(en) as MessageKey[]) {
      const own = params(CATALOGS[lang][key]);
      const english = params(en[key]);
      // Korean may add {element} next to an icon, so particles can attach to a word.
      expect(own.filter((p) => !english.includes(p) && !(lang === 'ko' && p === 'element')), key).toEqual([]);
      expect(english.filter((p) => !own.includes(p) && !DROPPED[key]?.includes(p)), key).toEqual([]);
      expect(CATALOGS[lang][key].trim(), key).not.toBe('');
    }
  });

  it('add Korean particles only in Korean', () => {
    const particle = /\{\w+\|/;
    for (const lang of TRANSLATIONS.filter((l) => l !== 'ko')) {
      for (const [key, text] of Object.entries(CATALOGS[lang])) expect(particle.test(text), `${lang} ${key}`).toBe(false);
      expect(particle.test(JSON.stringify(CONTENT[lang])), lang).toBe(false);
    }
  });

  it('join lists the way each language does', () => {
    expect(listOf([])).toBe('');
    expect(listOf(['Fireball'])).toBe('Fireball');
    expect(listOf(['Fireball', 'Mudslide', 'Tempest'])).toBe('Fireball, Mudslide and Tempest');
    setLanguage('ko');
    expect(listOf(['화염구', '산사태', '폭풍우'])).toBe('화염구, 산사태, 폭풍우');
    setLanguage('ja');
    expect(listOf(['ファイアボール', '土石流'])).toBe('ファイアボール、土石流');
    setLanguage('zh');
    expect(listOf(['火球', '泥石流', '暴风雨'])).toBe('火球、泥石流和暴风雨');
    setLanguage('es');
    expect(listOf(['Bola de fuego', 'Alud', 'Tempestad'])).toBe('Bola de fuego, Alud y Tempestad');
  });
});

describe('Korean particles', () => {
  it('follow the last syllable of the word', () => {
    expect(josa('화염구', '을')).toBe('를');
    expect(josa('진흙', '을')).toBe('을');
    expect(josa('폭풍', '이')).toBe('이');
    expect(josa('비', '이')).toBe('가');
    expect(josa('폭풍', '으로')).toBe('으로');
    expect(josa('물', '으로')).toBe('로');
    expect(josa('비', '으로')).toBe('로');
    expect(josa('정수', '은')).toBe('는');
  });

  it('skip punctuation and emoji, and read numbers aloud', () => {
    expect(josa('폭풍, 폭풍', '을')).toBe('을');
    expect(josa('🔥', '을')).toBe('를');
    expect(josa('3', '이')).toBe('이');
    expect(josa('2', '이')).toBe('가');
  });

  it('follow the word before a closing parenthetical', () => {
    expect(josa('장마 (비, 5턴)', '을')).toBe('를');
    expect(josa('폭풍 (2턴)', '이')).toBe('이');
  });

  it('are added by {name|particle} in Korean messages', () => {
    setLanguage('ko');
    expect(t('ev.weatherEnemy', { enemy: '폭풍술사', weather: '폭풍' })).toBe('폭풍술사가 폭풍을 불렀습니다!');
    expect(t('ev.weatherSchedule', { weather: '비' })).toBe('날씨가 비로 바뀌었습니다.');
  });
});

/** Every name and text a content table holds, with where it is, for the checks below. */
function entries(table: ContentTable): { where: string; text: string; allowed: string[] }[] {
  const out: { where: string; text: string; allowed: string[] }[] = [];
  const add = (where: string, text: string | undefined, allowed: string[] = []) => {
    if (text !== undefined) out.push({ where, text, allowed });
  };
  for (const [id, c] of Object.entries(table.cards)) {
    add(`card ${id}`, c.name);
    add(`card ${id} text`, c.text, ['damage']);
  }
  for (const [id, r] of Object.entries(table.recipes)) {
    add(`recipe ${id}`, r.name);
    add(`recipe ${id} text`, r.text, ['damage']);
    add(`recipe ${id} card text`, r.cardText, ['damage']);
  }
  for (const [id, name] of Object.entries(table.enemies)) add(`enemy ${id}`, name);
  for (const [id, name] of Object.entries(table.moves)) add(`move ${id}`, name);
  for (const [id, r] of Object.entries(table.relics)) {
    add(`relic ${id}`, r.name);
    add(`relic ${id} text`, r.text);
  }
  for (const [n, name] of Object.entries(table.acts)) add(`act ${n}`, name);
  for (const [id, s] of Object.entries(table.sky)) {
    add(`sky ${id}`, s.name);
    add(`sky ${id} text`, s.text, ['turns']);
  }
  for (const [id, e] of Object.entries(table.events)) {
    add(`event ${id}`, e.name);
    add(`event ${id} text`, e.text);
    for (const [o, option] of Object.entries(e.options)) {
      add(`event ${id}.${o}`, option.label);
      add(`event ${id}.${o} text`, option.text);
    }
  }
  return out;
}

describe.each(TRANSLATIONS)('%s content', (lang) => {
  const table = CONTENT[lang] as ContentTable;

  it('has every card, recipe, enemy, move, relic, act, weather card and event', () => {
    for (const id of Object.keys(CARDS)) expect(table.cards[id], id).toBeDefined();
    for (const r of [...RECIPES, SLUDGE]) expect(table.recipes[r.id], r.id).toBeDefined();
    for (const [id, def] of Object.entries(ENEMIES)) {
      expect(table.enemies[id], id).toBeDefined();
      for (const move of [...def.moves, ...(def.phase2?.moves ?? [])]) expect(table.moves[move.name], move.name).toBeDefined();
    }
    for (const id of Object.keys(RELICS)) expect(table.relics[id], id).toBeDefined();
    for (const act of ACTS) expect(table.acts[act.number], `act ${act.number}`).toBeDefined();
    for (const id of Object.keys(SKY_CARDS)) expect(table.sky[id], id).toBeDefined();
    for (const [id, event] of Object.entries(EVENTS)) {
      expect(table.events[id], id).toBeDefined();
      for (const option of event.options) expect(table.events[id]?.options[option.id], `${id}.${option.id}`).toBeDefined();
    }
  });

  it('has nothing left over from content that no longer exists', () => {
    const moves = new Set(Object.values(ENEMIES).flatMap((def) => [...def.moves, ...(def.phase2?.moves ?? [])].map((m) => m.name)));
    for (const id of Object.keys(table.cards)) expect(CARDS[id], id).toBeDefined();
    for (const id of Object.keys(table.recipes)) expect([...RECIPES, SLUDGE].some((r) => r.id === id), id).toBe(true);
    for (const id of Object.keys(table.enemies)) expect(ENEMIES[id], id).toBeDefined();
    for (const name of Object.keys(table.moves)) expect(moves.has(name), name).toBe(true);
    for (const id of Object.keys(table.relics)) expect(RELICS[id], id).toBeDefined();
    for (const id of Object.keys(table.sky)) expect(SKY_CARDS[id], id).toBeDefined();
    for (const [id, event] of Object.entries(table.events)) {
      expect(EVENTS[id], id).toBeDefined();
      for (const option of Object.keys(event.options)) expect(EVENTS[id]?.options.some((o) => o.id === option), `${id}.${option}`).toBe(true);
    }
  });

  it('keeps {damage} wherever the English text shows damage', () => {
    for (const def of Object.values(CARDS)) {
      expect(table.cards[def.id]?.text.includes('{damage}'), def.id).toBe(def.text.includes('{damage}'));
    }
    for (const r of RECIPES) {
      expect(table.recipes[r.id]?.text.includes('{damage}'), r.id).toBe(r.text.includes('{damage}'));
      const own = table.recipes[r.id]?.cardText;
      if (own) expect(own.includes('{damage}'), `${r.id} card text`).toBe(r.text.includes('{damage}'));
    }
  });

  it('writes weather card lengths as {turns}', () => {
    for (const id of Object.keys(SKY_CARDS)) expect(table.sky[id]?.text, id).toContain('{turns}');
  });

  it('fills in every name and text, with no unknown placeholders', () => {
    for (const { where, text, allowed } of entries(table)) {
      expect(text.trim(), where).not.toBe('');
      expect(params(text).filter((p) => !allowed.includes(p)), where).toEqual([]);
    }
  });

  it('shows translated names on screen', () => {
    setLanguage(lang);
    expect(enemyName('stormCaller')).not.toBe(ENEMIES.stormCaller?.name);
    expect(recipeName('fireball')).not.toBe('Fireball');
    expect(cardName(getCard(flaskId('fireball')))).toContain(recipeName('fireball'));
    expect(skyText('monsoon')).toContain('5');
    expect(skyText('monsoon')).not.toContain('{');
  });
});

describe('Korean content', () => {
  it('names and describes distilled cards from their recipe', () => {
    setLanguage('ko');
    expect(cardName(getCard(flaskId('fireball')))).toBe('화염구 플라스크');
    expect(cardName(getCard(essenceId('fireball')))).toBe('화염구의 정수');
    expect(cardText(getCard(essenceId('thunderhead')))).toBe('💧🌬️⚡ 추가.');
    setLanguage('en');
    // English generated names are the same as the card data's own.
    for (const def of Object.values(DISTILLED_CARDS)) {
      expect(cardName(def)).toBe(def.name);
      expect(cardText(def)).toBe(def.text);
    }
  });

  it('switches names, weather texts and game messages with the language', () => {
    const run = createRun(1);
    setLanguage('ko');
    expect(enemyName('stormCaller')).toBe('폭풍술사');
    expect(recipeName('fireball')).toBe('화염구');
    expect(skyText('monsoon')).toBe('5턴 동안 비.');
    expect(weatherEffect('storm')).toContain('5');
    expect(buyCard(run, 0)).toEqual({ ok: false, reason: '품절입니다.' });
    setLanguage('en');
    expect(buyCard(run, 0)).toEqual({ ok: false, reason: 'Sold out.' });
  });
});

describe('settings', () => {
  it('default to English with sound, vibration and effects on', () => {
    const defaults = { language: 'en', sound: true, vibration: true, effects: true };
    expect(parseSettings(null)).toEqual(defaults);
    expect(parseSettings('not json')).toEqual(defaults);
    expect(parseSettings(JSON.stringify({ language: 'xx', sound: 'loud' }))).toEqual(defaults);
  });

  it('keep what was saved', () => {
    const saved = { language: 'ko', sound: false, vibration: true, effects: false };
    expect(parseSettings(JSON.stringify(saved))).toEqual(saved);
    // Settings saved before the on/off options existed keep their language.
    expect(parseSettings(JSON.stringify({ language: 'ko' }))).toEqual({ ...saved, sound: true, effects: true });
    for (const { id } of LANGUAGES) expect(parseSettings(JSON.stringify({ language: id })).language).toBe(id);
  });
});
