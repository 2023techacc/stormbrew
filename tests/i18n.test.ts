import { afterEach, describe, expect, it } from 'vitest';
import { createRun, buyCard } from '../src/core/run';
import { CARDS, getCard } from '../src/data/cards';
import { DISTILLED_CARDS, essenceId, flaskId } from '../src/data/distilled';
import { ENEMIES } from '../src/data/enemies';
import { EVENTS } from '../src/data/events';
import { RECIPES, SLUDGE } from '../src/data/recipes';
import { RELICS } from '../src/data/relics';
import { SKY_CARDS } from '../src/data/sky';
import { format, josa, setLanguage, t } from '../src/i18n';
import { cardName, cardText, enemyName, recipeName, skyText, weatherEffect } from '../src/i18n/content';
import { en } from '../src/i18n/en';
import { ko } from '../src/i18n/ko';
import { KO_CARDS, KO_ENEMIES, KO_EVENTS, KO_MOVES, KO_RECIPES, KO_RELICS, KO_SKY } from '../src/i18n/ko-content';
import { parseSettings } from '../src/ui/settings';

afterEach(() => setLanguage('en'));

const params = (text: string) => [...text.matchAll(/\{(\w+)(?:\|[^}]+)?\}/g)].map((m) => m[1]).sort();

describe('messages', () => {
  it('fill in parameters and keep unknown placeholders for the card renderer', () => {
    expect(format('Deal {damage}. Draw {n}.', { n: 2 })).toBe('Deal {damage}. Draw 2.');
    expect(t('combat.turn', { turn: 3 })).toBe('Turn 3');
    setLanguage('ko');
    expect(t('combat.turn', { turn: 3 })).toBe('3턴');
  });

  it('every Korean message uses parameters the English one has', () => {
    // Korean may add {element} next to an icon, so particles can attach to a word.
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const extra = params(ko[key]).filter((p) => !params(en[key]).includes(p) && p !== 'element');
      expect(extra, key).toEqual([]);
    }
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
    expect(josa('장마 (비, 5턴)', '을')).toBe('을');
    expect(josa('🔥', '을')).toBe('를');
    expect(josa('3', '이')).toBe('이');
    expect(josa('2', '이')).toBe('가');
  });

  it('are added by {name|particle} in Korean messages', () => {
    setLanguage('ko');
    expect(t('ev.weatherEnemy', { enemy: '폭풍술사', weather: '폭풍' })).toBe('폭풍술사가 폭풍을 불렀습니다!');
    expect(t('ev.weatherSchedule', { weather: '비' })).toBe('날씨가 비로 바뀌었습니다.');
  });
});

describe('Korean content', () => {
  it('has every card, recipe, enemy, move, relic, weather card and event', () => {
    for (const id of Object.keys(CARDS)) expect(KO_CARDS[id], id).toBeDefined();
    for (const r of [...RECIPES, SLUDGE]) expect(KO_RECIPES[r.id], r.id).toBeDefined();
    for (const [id, def] of Object.entries(ENEMIES)) {
      expect(KO_ENEMIES[id], id).toBeDefined();
      for (const move of [...def.moves, ...(def.phase2?.moves ?? [])]) expect(KO_MOVES[move.name], move.name).toBeDefined();
    }
    for (const id of Object.keys(RELICS)) expect(KO_RELICS[id], id).toBeDefined();
    for (const id of Object.keys(SKY_CARDS)) expect(KO_SKY[id], id).toBeDefined();
    for (const [id, event] of Object.entries(EVENTS)) {
      expect(KO_EVENTS[id], id).toBeDefined();
      for (const option of event.options) expect(KO_EVENTS[id]?.options[option.id], `${id}.${option.id}`).toBeDefined();
    }
  });

  it('keeps {damage} wherever the English text shows damage', () => {
    for (const def of Object.values(CARDS)) {
      expect(KO_CARDS[def.id]?.text.includes('{damage}'), def.id).toBe(def.text.includes('{damage}'));
    }
    for (const r of RECIPES) expect(KO_RECIPES[r.id]?.text.includes('{damage}'), r.id).toBe(r.text.includes('{damage}'));
  });

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
  it('default to English and keep a valid saved language', () => {
    expect(parseSettings(null)).toEqual({ language: 'en' });
    expect(parseSettings('not json')).toEqual({ language: 'en' });
    expect(parseSettings(JSON.stringify({ language: 'xx' }))).toEqual({ language: 'en' });
    expect(parseSettings(JSON.stringify({ language: 'ko' }))).toEqual({ language: 'ko' });
  });
});
