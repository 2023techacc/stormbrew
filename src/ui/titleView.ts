import { Capacitor } from '@capacitor/core';
import { isKnown, type Grimoire } from '../core/grimoire';
import { RECIPES } from '../data/recipes';
import { esc } from './dom';
import { baseText } from './text';
import { ELEMENTS, ICONS, WEATHERS, type Look } from './theme';

const chip = (look: Look) =>
  `<span class="chip" style="--chip-color: ${look.color}" title="${esc(look.name)}">${look.icon}</span>`;

export interface TitleActions {
  /** Present when there is a saved run to continue. */
  onContinue?: () => void;
  onNewRun: () => void;
  onSandbox: () => void;
  onGrimoire: () => void;
}

export function showTitle(root: HTMLElement, actions: TitleActions): void {
  let confirmNewRun = false;
  const render = () => {
    root.innerHTML = `
      <main class="title-screen">
        <header>
          <h1>Stormbrew</h1>
          <p class="tagline">Brew the elements. Bend the sky.</p>
        </header>
        <section class="row" aria-label="Weathers">
          ${Object.values(WEATHERS).map(chip).join('')}
        </section>
        <section class="row" aria-label="Elements">
          ${Object.values(ELEMENTS).map(chip).join('')}
        </section>
        <span class="title-buttons">
          ${actions.onContinue ? '<button class="primary-button" data-action="continue">Continue run</button>' : ''}
          <button class="${actions.onContinue ? 'secondary-button' : 'primary-button'}" data-action="new-run">
            ${confirmNewRun ? 'Tap again to abandon your run' : 'New run'}
          </button>
          <button class="secondary-button" data-action="grimoire">${ICONS.grimoire} Grimoire</button>
          <button class="text-button" data-action="sandbox">Sandbox</button>
        </span>
        <footer>v${esc(__APP_VERSION__)} · ${esc(Capacitor.getPlatform())}</footer>
      </main>
    `;
  };
  root.onclick = (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'continue') actions.onContinue?.();
    else if (action === 'new-run') {
      // Starting over deletes the saved run, so ask for a second tap first.
      if (actions.onContinue && !confirmNewRun) {
        confirmNewRun = true;
        render();
      } else actions.onNewRun();
    } else if (action === 'sandbox') actions.onSandbox();
    else if (action === 'grimoire') actions.onGrimoire();
  };
  render();
}

/** The recipes discovered so far, kept between runs. */
export function showGrimoire(root: HTMLElement, grimoire: Grimoire, onBack: () => void): void {
  const known = RECIPES.filter((r) => isKnown(grimoire, r.id));
  root.innerHTML = `
    <main class="screen">
      <h2>${ICONS.grimoire} Grimoire</h2>
      <p class="muted">${known.length} of ${RECIPES.length} recipes discovered. Brew new combinations in fights to fill it in.</p>
      <ul class="recipe-list grimoire-list">
        ${RECIPES.map((r) =>
          isKnown(grimoire, r.id)
            ? `<li class="recipe"><span class="recipe-elements">${r.elements.map((e) => ELEMENTS[e].icon).join('')}</span>
                <span class="recipe-body"><strong>${esc(r.name)}</strong> ${esc(baseText(r))}</span></li>`
            : `<li class="recipe unknown"><span class="recipe-elements">${r.elements.map(() => '❔').join('')}</span>
                <span class="recipe-body"><strong>???</strong></span></li>`,
        ).join('')}
      </ul>
      <button class="primary-button" data-action="back">Back</button>
    </main>
  `;
  root.onclick = (event) => {
    if ((event.target as HTMLElement).closest('[data-action="back"]')) onBack();
  };
}
