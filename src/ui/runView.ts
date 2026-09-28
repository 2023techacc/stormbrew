import { addCardToDeck, createRun, finishFight, rewardChoices, startFight, type RunState } from '../core/run';
import type { CombatState } from '../core/types';
import { getCard } from '../data/cards';
import { cardFace, showCombat } from './combatView';
import { esc } from './dom';

/** A run: fight, pick a card reward, fight again, until you're defeated. */
export function showRun(root: HTMLElement, onExit: () => void): void {
  let run: RunState = createRun(Math.floor(Math.random() * 2 ** 32));

  const nextFight = () => {
    const { state } = startFight(run);
    showCombat(root, {
      state,
      label: `Fight ${run.fightsWon + 1}`,
      onFinished: afterFight,
      onExit,
    });
  };

  const afterFight = (combat: CombatState) => {
    const healed = finishFight(run, combat);
    if (combat.status === 'won') showReward(healed);
    else showRunOver();
  };

  const showReward = (healed: number) => {
    const choices = rewardChoices(run);
    root.innerHTML = `
      <main class="screen reward-screen">
        <h2>Victory!</h2>
        <p class="muted">
          Fights won: ${run.fightsWon} · HP ${run.hp}/${run.maxHp}${healed > 0 ? ` (+${healed} healed)` : ''}
        </p>
        <p>Choose a card to add to your deck:</p>
        <section class="reward-cards">
          ${choices.map((id) => cardFace(getCard(id), 'clear', { attrs: `data-reward="${esc(id)}"` })).join('')}
        </section>
        <button class="text-button" data-action="skip">Skip</button>
        <p class="muted small">Deck: ${run.deck.length} cards</p>
      </main>
    `;
    root.onclick = (event) => {
      const el = (event.target as HTMLElement).closest<HTMLElement>('[data-reward],[data-action]');
      if (!el) return;
      if (el.dataset.reward) addCardToDeck(run, el.dataset.reward);
      else if (el.dataset.action !== 'skip') return;
      root.onclick = null;
      nextFight();
    };
  };

  const showRunOver = () => {
    root.innerHTML = `
      <main class="screen">
        <h2>Defeated</h2>
        <p>You won ${run.fightsWon} fight${run.fightsWon === 1 ? '' : 's'} with a ${run.deck.length}-card deck.</p>
        <button class="primary-button" data-action="new-run">New run</button>
        <button class="text-button" data-action="title">Back to title</button>
      </main>
    `;
    root.onclick = (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'new-run') {
        root.onclick = null;
        run = createRun(Math.floor(Math.random() * 2 ** 32));
        nextFight();
      } else if (action === 'title') {
        root.onclick = null;
        onExit();
      }
    };
  };

  nextFight();
}
