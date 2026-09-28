import './style.css';
import { showCombat } from './ui/combatView';
import { showTitle } from './ui/titleView';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app element not found');
const root: HTMLElement = app;

function goToTitle(): void {
  showTitle(root, startFight);
}

function startFight(): void {
  showCombat(root, { onExit: goToTitle });
}

goToTitle();
