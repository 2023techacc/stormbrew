import {
  cannotPlayReason,
  createCombat,
  currentIntent,
  endTurn,
  isAlive,
  playCard,
} from '../core/combat';
import type { CardInstance, CombatEvent, CombatState, EnemyState, UnitRef } from '../core/types';
import { STARTER_DECK, getCard } from '../data/cards';
import { esc } from './dom';
import { CARD_KIND_COLORS, ENEMY_LOOKS, ICONS } from './theme';

const PLAYER_MAX_HP = 75;

interface CombatViewOptions {
  onExit: () => void;
}

/**
 * The fight screen. Touch flow: tap a card to select it, then tap an enemy
 * (attacks) or tap the card again (skills, or attacks with only one enemy).
 */
export function showCombat(root: HTMLElement, options: CombatViewOptions): void {
  let state: CombatState;
  let selectedUid: number | null = null;
  let hint = '';

  const newFight = () => {
    ({ state } = createCombat({
      seed: Math.floor(Math.random() * 2 ** 32),
      deck: STARTER_DECK,
      enemies: ['cinderImp'],
      playerHp: PLAYER_MAX_HP,
      playerMaxHp: PLAYER_MAX_HP,
    }));
    selectedUid = null;
    hint = 'Tap a card to select it.';
    render();
  };

  const render = () => {
    root.innerHTML = renderCombat(state, selectedUid, hint);
  };

  const tryPlay = (uid: number, targetIndex?: number) => {
    const result = playCard(state, uid, targetIndex);
    if (!result.ok) {
      hint = result.reason;
      render();
      return;
    }
    selectedUid = null;
    hint = '';
    render();
    animate(root, result.events);
  };

  const onCardTap = (uid: number) => {
    const card = state.hand.find((c) => c.uid === uid);
    if (!card) return;
    const blocked = cannotPlayReason(state, card);
    if (blocked) {
      selectedUid = null;
      hint = blocked;
      render();
      shake(root.querySelector(`[data-uid="${uid}"]`));
      return;
    }

    const def = getCard(card.defId);
    const living = state.enemies.flatMap((e, i) => (isAlive(e) ? [i] : []));
    if (selectedUid === uid) {
      // Second tap plays it when the target is obvious.
      if (def.target === 'self') return tryPlay(uid);
      if (living.length === 1) return tryPlay(uid, living[0]);
    }
    selectedUid = uid;
    hint =
      def.target === 'enemy'
        ? living.length === 1
          ? 'Tap the enemy, or tap the card again.'
          : 'Tap an enemy.'
        : 'Tap the card again to play it.';
    render();
  };

  const onEnemyTap = (index: number) => {
    if (selectedUid === null) return;
    const card = state.hand.find((c) => c.uid === selectedUid);
    if (card && getCard(card.defId).target === 'enemy') tryPlay(card.uid, index);
  };

  const onEndTurn = () => {
    selectedUid = null;
    const events = endTurn(state);
    hint = '';
    render();
    animate(root, events);
  };

  root.onclick = (event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-uid],[data-enemy],[data-action]');
    if (!el) {
      if (selectedUid !== null) {
        selectedUid = null;
        hint = '';
        render();
      }
      return;
    }
    if (el.dataset.uid !== undefined) onCardTap(Number(el.dataset.uid));
    else if (el.dataset.enemy !== undefined) onEnemyTap(Number(el.dataset.enemy));
    else if (el.dataset.action === 'end-turn') onEndTurn();
    else if (el.dataset.action === 'restart') newFight();
    else if (el.dataset.action === 'exit') {
      root.onclick = null;
      options.onExit();
    }
  };

  newFight();
}

function renderCombat(state: CombatState, selectedUid: number | null, hint: string): string {
  const selected = state.hand.find((c) => c.uid === selectedUid);
  const targeting = selected !== undefined && getCard(selected.defId).target === 'enemy';
  const { player } = state;

  return `
    <main class="combat">
      <header class="top-bar">
        <span>Turn ${state.turn}</span>
        <button class="text-button" data-action="exit">Quit</button>
      </header>

      <section class="enemies">
        ${state.enemies.map((e, i) => renderEnemy(e, i, targeting)).join('')}
      </section>

      <p class="hint" aria-live="polite">${esc(hint)}</p>

      <section class="player unit" data-unit="player">
        <span class="energy" title="Energy">
          <span class="energy-value">${player.energy}/${player.maxEnergy}</span>
        </span>
        <span class="player-stats">
          <span class="unit-name">You</span>
          ${renderHpBar(player.hp, player.maxHp, player.block)}
        </span>
      </section>

      <section class="hand" aria-label="Hand">
        ${state.hand.map((c) => renderCard(state, c, c.uid === selectedUid)).join('')}
      </section>

      <footer class="controls">
        <span class="pile" title="Draw pile">${ICONS.drawPile} ${state.drawPile.length}</span>
        <button class="primary-button" data-action="end-turn" ${state.status === 'playing' ? '' : 'disabled'}>
          End turn
        </button>
        <span class="pile" title="Discard pile">${ICONS.discardPile} ${state.discardPile.length}</span>
      </footer>

      ${state.status === 'playing' ? '' : renderResult(state)}
    </main>
  `;
}

function renderEnemy(enemy: EnemyState, index: number, targeting: boolean): string {
  const look = ENEMY_LOOKS[enemy.defId] ?? { name: enemy.name, icon: '👾', color: '#888' };
  if (!isAlive(enemy)) {
    return `<span class="enemy unit defeated" data-unit="enemy-${index}">
      <span class="enemy-body" style="--unit-color: ${look.color}">💨</span>
      <span class="unit-name">${esc(enemy.name)}</span>
    </span>`;
  }
  const move = currentIntent(enemy);
  const intentParts = [
    move.damage ? `${ICONS.attack} ${move.damage}` : '',
    move.block ? `${ICONS.block} ${move.block}` : '',
  ].filter(Boolean);
  return `
    <button class="enemy unit ${targeting ? 'targetable' : ''}" data-enemy="${index}" data-unit="enemy-${index}"
      aria-label="${esc(enemy.name)}, ${enemy.hp} HP">
      <span class="intent" title="Next: ${esc(move.name)}">${intentParts.join(' ')}</span>
      <span class="enemy-body" style="--unit-color: ${look.color}">${look.icon}</span>
      <span class="unit-name">${esc(enemy.name)}</span>
      ${renderHpBar(enemy.hp, enemy.maxHp, enemy.block)}
    </button>
  `;
}

function renderHpBar(hp: number, maxHp: number, block: number): string {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return `
    <span class="hp-row">
      ${block > 0 ? `<span class="block-badge" title="Block">${ICONS.block} ${block}</span>` : ''}
      <span class="hp-bar ${block > 0 ? 'has-block' : ''}">
        <span class="hp-fill" style="width: ${pct}%"></span>
        <span class="hp-text">${hp}/${maxHp}</span>
      </span>
    </span>
  `;
}

function renderCard(state: CombatState, card: CardInstance, selected: boolean): string {
  const def = getCard(card.defId);
  const playable = cannotPlayReason(state, card) === null;
  return `
    <button class="card ${selected ? 'selected' : ''} ${playable ? '' : 'unplayable'}"
      data-uid="${card.uid}" style="--card-color: ${CARD_KIND_COLORS[def.kind]}"
      aria-label="${esc(def.name)}, costs ${def.cost}. ${esc(def.text)}">
      <span class="card-cost">${def.cost}</span>
      <span class="card-name">${esc(def.name)}</span>
      <span class="card-icon">${def.kind === 'attack' ? ICONS.attack : ICONS.block}</span>
      <span class="card-text">${esc(def.text)}</span>
    </button>
  `;
}

function renderResult(state: CombatState): string {
  const won = state.status === 'won';
  return `
    <span class="overlay">
      <span class="result-panel">
        <h2>${won ? 'Victory!' : 'Defeated'}</h2>
        <p>${won ? `You won in ${state.turn} turn${state.turn === 1 ? '' : 's'}.` : 'The storm got the better of you.'}</p>
        <button class="primary-button" data-action="restart">${won ? 'Fight again' : 'Try again'}</button>
        <button class="text-button" data-action="exit">Back to title</button>
      </span>
    </span>
  `;
}

function unitSelector(ref: UnitRef): string {
  return ref.side === 'player' ? '[data-unit="player"]' : `[data-unit="enemy-${ref.index}"]`;
}

/** Floating numbers and hit flashes for what just happened. */
function animate(root: HTMLElement, events: CombatEvent[]): void {
  for (const event of events) {
    if (event.type !== 'damage' && event.type !== 'block') continue;
    const unit = root.querySelector<HTMLElement>(unitSelector(event.target));
    if (!unit) continue;
    const float = document.createElement('span');
    if (event.type === 'damage') {
      float.className = 'float damage';
      float.textContent = event.amount > 0 ? `-${event.amount}` : 'Blocked';
      if (event.amount > 0) flash(unit);
    } else {
      float.className = 'float block';
      float.textContent = `+${event.amount} ${ICONS.block}`;
    }
    unit.appendChild(float);
    float.addEventListener('animationend', () => float.remove());
  }
}

function flash(el: Element): void {
  el.classList.remove('hit');
  void (el as HTMLElement).offsetWidth; // restart the animation
  el.classList.add('hit');
}

function shake(el: Element | null): void {
  if (!el) return;
  el.classList.remove('shake');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('shake');
}
