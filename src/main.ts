import './style.css';
import { SANDBOX_ENEMIES, createSandbox } from './core/sandbox';
import { setLanguage, type Lang } from './i18n';
import { showCombat } from './ui/combatView';
import { showRun } from './ui/runView';
import { loadGrimoire, loadRun, loadSettings, saveSettings } from './ui/storage';
import { showGrimoire, showSettings, showTitle } from './ui/titleView';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app element not found');
const root: HTMLElement = app;

/** Discovered recipes, kept across runs. Loaded once and updated in place. */
const grimoire = loadGrimoire();

const settings = loadSettings();
applyLanguage(settings.language);

function applyLanguage(lang: Lang): void {
  setLanguage(lang);
  document.documentElement.lang = lang;
}

function goToTitle(): void {
  window.scrollTo(0, 0);
  const saved = loadRun();
  showTitle(root, {
    onContinue: saved ? () => showRun(root, { onExit: goToTitle, grimoire, resume: saved }) : undefined,
    onNewRun: () => showRun(root, { onExit: goToTitle, grimoire }),
    onSandbox: () => startSandbox(0),
    onGrimoire: () => showGrimoire(root, grimoire, goToTitle),
    onSettings: () =>
      showSettings(root, {
        onLanguage: (lang) => {
          settings.language = lang;
          saveSettings(settings);
          applyLanguage(lang);
        },
        onBack: goToTitle,
      }),
  });
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
