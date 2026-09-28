import './style.css';
import { SANDBOX_ENEMIES, createSandbox } from './core/sandbox';
import { showCombat } from './ui/combatView';
import { showRun } from './ui/runView';
import { showTitle } from './ui/titleView';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app element not found');
const root: HTMLElement = app;

function goToTitle(): void {
  showTitle(root, { onNewRun: () => showRun(root, goToTitle), onSandbox: () => startSandbox(0) });
}

function startSandbox(enemyIndex: number): void {
  const enemy = SANDBOX_ENEMIES[enemyIndex % SANDBOX_ENEMIES.length] ?? 'trainingDummy';
  showCombat(root, {
    state: createSandbox(enemy, Math.floor(Math.random() * 2 ** 32)),
    onFinished: () => startSandbox(enemyIndex),
    onExit: goToTitle,
    sandbox: { onNextEnemy: () => startSandbox(enemyIndex + 1) },
  });
}

goToTitle();
