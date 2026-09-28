import {
  cannotPlayReason,
  createCombat,
  currentIntent,
  endTurn,
  isAlive,
  isWeathered,
  playCard,
} from '../core/combat';
import type {
  CardDef,
  CardInstance,
  Combatant,
  CombatEvent,
  CombatState,
  EnemyState,
  UnitRef,
  WeatherId,
} from '../core/types';
import { WEATHER_IDS, WEATHER_INFO, modifyDamage, turnsUntilChange } from '../core/weather';
import { STARTER_DECK, getCard } from '../data/cards';
import { ENCOUNTERS } from '../data/enemies';
import { esc } from './dom';
import { CARD_ICONS, CARD_KIND_COLORS, ENEMY_LOOKS, ICONS, WEATHERS } from './theme';

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
      enemies: ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)] ?? ['cinderImp'],
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
    hint = describeEvents(state, result.events);
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
    hint = describeEvents(state, events);
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
    else if (el.dataset.action === 'forecast') {
      selectedUid = null;
      hint = describeForecast(state);
      render();
    }
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
    <main class="combat" style="--weather-color: ${WEATHERS[state.weather.current].color}">
      <header class="top-bar">
        <span>Turn ${state.turn}</span>
        <button class="text-button" data-action="exit">Quit</button>
      </header>

      ${renderForecast(state)}

      <section class="enemies">
        ${state.enemies.map((e, i) => renderEnemy(e, i, targeting, state.weather.current)).join('')}
      </section>

      <p class="hint" aria-live="polite">${esc(hint)}</p>

      <section class="player unit" data-unit="player">
        <span class="energy" title="Energy">
          <span class="energy-value">${player.energy}/${player.maxEnergy}</span>
        </span>
        <span class="player-stats">
          <span class="unit-name">You</span>
          ${renderHpBar(player)}
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

function renderEnemy(
  enemy: EnemyState,
  index: number,
  targeting: boolean,
  weather: WeatherId,
): string {
  const look = ENEMY_LOOKS[enemy.defId] ?? { name: enemy.name, icon: '👾', color: '#888' };
  if (!isAlive(enemy)) {
    return `<span class="enemy unit defeated" data-unit="enemy-${index}">
      <span class="enemy-body" style="--unit-color: ${look.color}">💨</span>
      <span class="unit-name">${esc(enemy.name)}</span>
    </span>`;
  }
  const move = currentIntent(enemy);
  // An enemy's own weather move happens before its attack, so preview damage in that weather.
  const attackWeather = move.weather ?? weather;
  const intentParts = [
    move.weather ? WEATHERS[move.weather].icon : '',
    move.damage
      ? `${ICONS.attack} ${modifyDamage(move.damage, move.element, attackWeather)}${move.element === 'fire' ? ICONS.burn : ''}`
      : '',
    move.block ? `${ICONS.block} ${move.block}` : '',
  ].filter(Boolean);
  const weathered = WEATHER_IDS.filter((w) => isWeathered(enemy, w));
  return `
    <button class="enemy unit ${targeting ? 'targetable' : ''}" data-enemy="${index}" data-unit="enemy-${index}"
      aria-label="${esc(enemy.name)}, ${enemy.hp} HP">
      <span class="intent" title="Next: ${esc(move.name)}">${intentParts.join(' ')}</span>
      <span class="enemy-body" style="--unit-color: ${look.color}">${look.icon}</span>
      <span class="unit-name">${esc(enemy.name)}</span>
      ${
        weathered.length
          ? `<span class="weathered" title="Ignores harmful effects of ${weathered.map((w) => WEATHER_INFO[w].name).join(', ')}">Weathered ${weathered.map((w) => WEATHERS[w].icon).join('')}</span>`
          : ''
      }
      ${renderHpBar(enemy)}
    </button>
  `;
}

function renderHpBar(unit: Combatant): string {
  const { hp, maxHp, block } = unit;
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const burn = unit.statuses.burn ?? 0;
  return `
    <span class="hp-row">
      ${block > 0 ? `<span class="block-badge" title="Block">${ICONS.block} ${block}</span>` : ''}
      ${burn > 0 ? `<span class="burn-badge" title="Burn: lose ${burn} HP at end of turn">${ICONS.burn} ${burn}</span>` : ''}
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
      aria-label="${esc(def.name)}, costs ${def.cost}. ${esc(plainCardText(def, state.weather.current))}">
      <span class="card-cost">${def.cost}</span>
      <span class="card-name">${esc(def.name)}</span>
      <span class="card-icon">${CARD_ICONS[def.id] ?? (def.kind === 'attack' ? ICONS.attack : ICONS.block)}</span>
      <span class="card-text">${cardText(def, state.weather.current)}</span>
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

function renderForecast(state: CombatState): string {
  const { current, forecast } = state.weather;
  const next = forecast[0];
  const turns = turnsUntilChange(state.weather, state.turn);
  return `
    <button class="forecast" data-action="forecast" aria-label="Weather forecast">
      <span class="forecast-now" style="--chip-color: ${WEATHERS[current].color}">
        <span class="forecast-icon">${WEATHERS[current].icon}</span>
        <span class="forecast-text">
          <strong>${esc(WEATHER_INFO[current].name)}</strong>
          <small>${esc(WEATHER_INFO[current].effect)}</small>
        </span>
      </span>
      ${
        next
          ? `<span class="forecast-next" title="Next weather">
              <small>${turns === 1 ? 'Next turn' : `In ${turns} turns`}</small>
              <span class="forecast-icon">${WEATHERS[next].icon}</span>
            </span>`
          : ''
      }
    </button>
  `;
}

function describeForecast(state: CombatState): string {
  const { current, forecast } = state.weather;
  const next = forecast[0];
  const turns = turnsUntilChange(state.weather, state.turn);
  const now = `${WEATHER_INFO[current].name}: ${WEATHER_INFO[current].effect}`;
  if (!next) return now;
  const when = turns === 1 ? 'next turn' : `in ${turns} turns`;
  return `${now} Changes to ${WEATHER_INFO[next].name} ${when}.`;
}

/** A short message about the most important thing that just happened. */
function describeEvents(state: CombatState, events: CombatEvent[]): string {
  const messages: string[] = [];
  let actingEnemy = 'An enemy';
  for (const event of events) {
    if (event.type === 'enemyMove') {
      actingEnemy = state.enemies[event.index]?.name ?? 'An enemy';
    } else if (event.type === 'weather') {
      const name = WEATHER_INFO[event.to].name;
      const what =
        event.cause === 'schedule'
          ? `The weather turned to ${name}.`
          : event.cause === 'enemy'
            ? `${actingEnemy} summoned ${name}!`
            : `You summoned ${name}.`;
      messages.push(`${WEATHERS[event.to].icon} ${what} ${WEATHER_INFO[event.to].effect}`);
    } else if (event.type === 'damage' && event.source === 'lightning') {
      const name = event.target.side === 'player' ? 'you' : (state.enemies[event.target.index]?.name ?? 'an enemy');
      messages.push(`${ICONS.lightning} Lightning struck ${name}!`);
    }
  }
  return messages.join(' ');
}

/** The damage a card's first damage effect deals in the current weather. */
function cardDamage(def: CardDef, weather: WeatherId): { base: number; now: number } | null {
  const effect = def.effects.find((e) => e.type === 'damage');
  if (!effect || effect.type !== 'damage') return null;
  return { base: effect.amount, now: modifyDamage(effect.amount, effect.element, weather) };
}

function plainCardText(def: CardDef, weather: WeatherId): string {
  const damage = cardDamage(def, weather);
  return def.text.replace('{damage}', String(damage?.now ?? ''));
}

function cardText(def: CardDef, weather: WeatherId): string {
  const damage = cardDamage(def, weather);
  const [before, after = ''] = esc(def.text).split('{damage}');
  if (!damage || !def.text.includes('{damage}')) return esc(plainCardText(def, weather));
  const change = damage.now > damage.base ? 'buffed' : damage.now < damage.base ? 'nerfed' : '';
  return `${before}<span class="${change}">${damage.now}</span>${after}`;
}

function unitSelector(ref: UnitRef): string {
  return ref.side === 'player' ? '[data-unit="player"]' : `[data-unit="enemy-${ref.index}"]`;
}

/** Floating numbers and hit flashes for what just happened. */
function animate(root: HTMLElement, events: CombatEvent[]): void {
  for (const event of events) {
    if (event.type === 'weather') {
      flash(root.querySelector('.forecast'), 'weather-changed');
      continue;
    }
    if (event.type !== 'damage' && event.type !== 'block') continue;
    const unit = root.querySelector<HTMLElement>(unitSelector(event.target));
    if (!unit) continue;
    const float = document.createElement('span');
    if (event.type === 'damage') {
      float.className = `float damage ${event.source ?? ''}`;
      const icon = event.source === 'burn' ? ` ${ICONS.burn}` : event.source === 'lightning' ? ` ${ICONS.lightning}` : '';
      float.textContent = event.amount > 0 ? `-${event.amount}${icon}` : 'Blocked';
      if (event.amount > 0) flash(unit);
      if (event.source === 'lightning') flash(root.querySelector('.combat'), 'lightning-flash');
    } else {
      float.className = 'float block';
      float.textContent = `+${event.amount} ${ICONS.block}`;
    }
    unit.appendChild(float);
    float.addEventListener('animationend', () => float.remove());
  }
}

function flash(el: Element | null, className = 'hit'): void {
  if (!el) return;
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth; // restart the animation
  el.classList.add(className);
}

function shake(el: Element | null): void {
  if (!el) return;
  el.classList.remove('shake');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('shake');
}
