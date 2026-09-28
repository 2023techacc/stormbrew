import { Capacitor } from '@capacitor/core';
import { esc } from './dom';
import { ELEMENTS, WEATHERS, type Look } from './theme';

const chip = (look: Look) =>
  `<span class="chip" style="--chip-color: ${look.color}" title="${esc(look.name)}">${look.icon}</span>`;

export function showTitle(root: HTMLElement, actions: { onNewRun: () => void; onSandbox: () => void }): void {
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
        <button class="primary-button" data-action="new-run">New run</button>
        <button class="secondary-button" data-action="sandbox">Sandbox</button>
      </span>
      <footer>v${esc(__APP_VERSION__)} · ${esc(Capacitor.getPlatform())}</footer>
    </main>
  `;
  root.onclick = (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'new-run') actions.onNewRun();
    else if (action === 'sandbox') actions.onSandbox();
  };
}
