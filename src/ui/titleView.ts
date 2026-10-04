import { Capacitor } from '@capacitor/core';
import { isKnown, type Grimoire } from '../core/grimoire';
import type { ElementId, WeatherId } from '../core/types';
import { RECIPES, getRecipe } from '../data/recipes';
import { LANGUAGES, getLanguage, t, type Lang } from '../i18n';
import { elementName, recipeName, recipeText, weatherName } from '../i18n/content';
import { esc } from './dom';
import { buzz } from './haptics';
import { TOGGLES, type Settings, type Toggle } from './settings';
import { playSfx } from './sound';
import { baseText } from './text';
import { ELEMENTS, ICONS, WEATHERS, type Look } from './theme';
import { setWeatherFx } from './weatherFx';

const chip = (look: Look, name: string) =>
  `<span class="chip" style="--chip-color: ${look.color}" title="${esc(name)}">${look.icon}</span>`;

export interface TitleActions {
  /** Present when there is a saved run to continue. */
  onContinue?: () => void;
  onNewRun: () => void;
  onSandbox: () => void;
  onGrimoire: () => void;
  onSettings: () => void;
}

export function showTitle(root: HTMLElement, actions: TitleActions): void {
  setWeatherFx(null);
  let confirmNewRun = false;
  let entering = true;
  const render = () => {
    root.innerHTML = `
      <main class="title-screen ${entering ? 'enter' : ''}">
        <header>
          <h1>Stormbrew</h1>
          <p class="tagline">${esc(t('title.tagline'))}</p>
        </header>
        <section class="row" aria-label="${esc(t('title.weathers'))}">
          ${(Object.keys(WEATHERS) as WeatherId[]).map((w) => chip(WEATHERS[w], weatherName(w))).join('')}
        </section>
        <section class="row" aria-label="${esc(t('title.elements'))}">
          ${(Object.keys(ELEMENTS) as ElementId[]).map((e) => chip(ELEMENTS[e], elementName(e))).join('')}
        </section>
        <span class="title-buttons">
          ${actions.onContinue ? `<button class="primary-button" data-action="continue">${esc(t('title.continue'))}</button>` : ''}
          <button class="${actions.onContinue ? 'secondary-button' : 'primary-button'}" data-action="new-run">
            ${esc(t(confirmNewRun ? 'title.confirmNewRun' : 'title.newRun'))}
          </button>
          <button class="secondary-button" data-action="grimoire">${ICONS.grimoire} ${esc(t('title.grimoire'))}</button>
          <span class="title-row">
            <button class="text-button" data-action="sandbox">${esc(t('title.sandbox'))}</button>
            <button class="text-button" data-action="settings">${ICONS.settings} ${esc(t('title.settings'))}</button>
          </span>
        </span>
        <footer>v${esc(__APP_VERSION__)} · ${esc(Capacitor.getPlatform())}</footer>
      </main>
    `;
    entering = false;
  };
  root.onclick = (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action) playSfx('tap');
    if (action === 'continue') actions.onContinue?.();
    else if (action === 'new-run') {
      // Starting over deletes the saved run, so ask for a second tap first.
      if (actions.onContinue && !confirmNewRun) {
        confirmNewRun = true;
        render();
      } else actions.onNewRun();
    } else if (action === 'sandbox') actions.onSandbox();
    else if (action === 'grimoire') actions.onGrimoire();
    else if (action === 'settings') actions.onSettings();
  };
  render();
}

/** The recipes discovered so far, kept between runs. */
export function showGrimoire(root: HTMLElement, grimoire: Grimoire, onBack: () => void): void {
  setWeatherFx(null);
  const known = RECIPES.filter((r) => isKnown(grimoire, r.id));
  root.innerHTML = `
    <main class="screen enter">
      <h2>${ICONS.grimoire} ${esc(t('grimoire.title'))}</h2>
      <p class="muted">${esc(t('grimoire.progress', { known: known.length, total: RECIPES.length }))}</p>
      <ul class="recipe-list grimoire-list">
        ${RECIPES.map((r) =>
          isKnown(grimoire, r.id)
            ? `<li class="recipe"><span class="recipe-elements">${r.elements.map((e) => ELEMENTS[e].icon).join('')}</span>
                <span class="recipe-body"><strong>${esc(recipeName(r.id))}</strong> ${esc(
                  baseText({ effects: getRecipe(r.id).effects, text: recipeText(r.id) }),
                )}</span></li>`
            : `<li class="recipe unknown"><span class="recipe-elements">${r.elements.map(() => '❔').join('')}</span>
                <span class="recipe-body"><strong>???</strong></span></li>`,
        ).join('')}
      </ul>
      <button class="primary-button" data-action="back">${esc(t('common.back'))}</button>
    </main>
  `;
  root.onclick = (event) => {
    if (!(event.target as HTMLElement).closest('[data-action="back"]')) return;
    playSfx('tap');
    onBack();
  };
}

export interface SettingsActions {
  settings: Settings;
  onLanguage: (lang: Lang) => void;
  onToggle: (key: Toggle, on: boolean) => void;
  onBack: () => void;
}

const TOGGLE_LABELS = { sound: 'settings.sound', vibration: 'settings.vibration', effects: 'settings.effects' } as const;
const TOGGLE_ICONS: Record<Toggle, string> = { sound: '🔊', vibration: '📳', effects: '🌦️' };

/** Settings: language, sound, vibration and weather effects. Changes apply right away. */
export function showSettings(root: HTMLElement, actions: SettingsActions): void {
  setWeatherFx(null);
  const { settings } = actions;
  const choice = (selected: boolean, attrs: string, label: string, lang?: string) =>
    `<button class="choice-button ${selected ? 'selected' : ''}" ${attrs} aria-pressed="${selected}" ${lang ? `lang="${lang}"` : ''}>${esc(label)}</button>`;
  let entering = true;
  const render = () => {
    root.innerHTML = `
      <main class="screen ${entering ? 'enter' : ''}">
        <h2>${ICONS.settings} ${esc(t('settings.title'))}</h2>
        <section class="settings-group" aria-label="${esc(t('settings.language'))}">
          <h3>${esc(t('settings.language'))}</h3>
          <span class="choice-row languages">
            ${LANGUAGES.map((l) => choice(l.id === getLanguage(), `data-lang="${l.id}"`, l.name, l.tag)).join('')}
          </span>
        </section>
        ${TOGGLES.map(
          (key) => `
          <section class="settings-group" aria-label="${esc(t(TOGGLE_LABELS[key]))}">
            <h3>${TOGGLE_ICONS[key]} ${esc(t(TOGGLE_LABELS[key]))}</h3>
            <span class="choice-row">
              ${choice(settings[key], `data-toggle="${key}" data-on="1"`, t('settings.on'))}
              ${choice(!settings[key], `data-toggle="${key}" data-on="0"`, t('settings.off'))}
            </span>
          </section>`,
        ).join('')}
        <button class="primary-button" data-action="back">${esc(t('common.back'))}</button>
      </main>
    `;
    entering = false;
  };
  root.onclick = (event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-lang],[data-toggle],[data-action]');
    if (!el) return;
    // After the change, so turning sound on answers with a tap and turning it off is silent.
    if (el.dataset.lang) actions.onLanguage(el.dataset.lang as Lang);
    else if (el.dataset.toggle) actions.onToggle(el.dataset.toggle as Toggle, el.dataset.on === '1');
    playSfx('tap');
    if (el.dataset.toggle === 'vibration' && el.dataset.on === '1') buzz('medium');
    if (el.dataset.action === 'back') actions.onBack();
    else render();
  };
  render();
}
