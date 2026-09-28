import { Capacitor } from '@capacitor/core';
import './style.css';
import { ELEMENTS, WEATHERS, type Look } from './ui/theme';

const chip = (look: Look) =>
  `<span class="chip" style="--chip-color: ${look.color}" title="${look.name}">${look.icon}</span>`;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app element not found');

app.innerHTML = `
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
    <footer>
      v${__APP_VERSION__} · ${Capacitor.getPlatform()}
    </footer>
  </main>
`;
