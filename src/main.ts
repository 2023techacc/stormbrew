import './style.css';
import { SANDBOX_ENEMIES, createSandbox } from './core/sandbox';
import { langTag, setLanguage, type Lang } from './i18n';
import { showCombat } from './ui/combatView';
import { setVibrationEnabled } from './ui/haptics';
import { showRun } from './ui/runView';
import type { Settings } from './ui/settings';
import { setSoundEnabled, unlockAudio } from './ui/sound';
import { loadGrimoire, loadRun, loadSettings, saveSettings } from './ui/storage';
import { showGrimoire, showSettings, showTitle } from './ui/titleView';
import { setEffectsEnabled } from './ui/weatherFx';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app element not found');
const root: HTMLElement = app;

/** Discovered recipes, kept across runs. Loaded once and updated in place. */
const grimoire = loadGrimoire();

const settings = loadSettings();
applySettings(settings);

// Phones only allow sound after the player first touches the screen.
document.addEventListener('pointerdown', unlockAudio);

function applySettings(s: Settings): void {
  applyLanguage(s.language);
  setSoundEnabled(s.sound);
  setVibrationEnabled(s.vibration);
  setEffectsEnabled(s.effects);
  document.documentElement.classList.toggle('calm', !s.effects);
}

function applyLanguage(lang: Lang): void {
  setLanguage(lang);
  document.documentElement.lang = langTag(lang);
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
        settings,
        onLanguage: (lang) => {
          settings.language = lang;
          saveSettings(settings);
          applyLanguage(lang);
        },
        onToggle: (key, on) => {
          settings[key] = on;
          saveSettings(settings);
          applySettings(settings);
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
