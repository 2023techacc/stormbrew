import { WEATHER_ELEMENTS, findBrew } from '../core/brewing';
import {
  WEAK_MULTIPLIER,
  cannotPlayReason,
  cardEffects,
  cardNeedsTarget,
  hasRelic,
  currentIntent,
  endTurn,
  enemyAttackDamage,
  isAlive,
  isWeathered,
  playCard,
  potionNeedsTarget,
  previewCardBrew,
  usePotion,
} from '../core/combat';
import { discoverFrom, isKnown, type Grimoire } from '../core/grimoire';
import type {
  CardDef,
  CardInstance,
  Combatant,
  Effect,
  ElementId,
  RecipeDef,
  CombatEvent,
  CombatState,
  EnemyState,
  UnitRef,
  WeatherId,
} from '../core/types';
import { sandboxAddCard, sandboxRefillEnergy, sandboxSetWeather } from '../core/sandbox';
import { WEATHER_IDS, WEATHER_INFO, modifyDamage, turnsUntilChange } from '../core/weather';
import { CARDS, getCard } from '../data/cards';
import { RECIPES, SLUDGE, getRecipe } from '../data/recipes';
import { getRelic } from '../data/relics';
import { esc } from './dom';
import { CARD_ICONS, CARD_KIND_COLORS, ELEMENTS, ENEMY_LOOKS, ICONS, RELIC_ICONS, WEATHERS } from './theme';

export interface CombatViewOptions {
  state: CombatState;
  /** Shown in the top bar before the turn number, e.g. "Fight 3". */
  label?: string;
  /** Called when the player taps Continue after the fight ends. */
  onFinished: (state: CombatState) => void;
  onExit: () => void;
  /** Sandbox tools (add cards, change weather, refill energy, next enemy). */
  sandbox?: { onNextEnemy: () => void };
  /** Known recipes; unknown ones show as "???". Omit to show everything (sandbox). Updated as recipes are brewed. */
  grimoire?: Grimoire;
  /** Called after every change to the fight (for auto-save). */
  onChange?: (state: CombatState) => void;
}

type Overlay = 'none' | 'recipes' | 'cards';

/**
 * One fight. Touch flow: tap a card to select it, then tap an enemy (when the
 * card or its brew needs a target) or tap the card again.
 */
export function showCombat(root: HTMLElement, options: CombatViewOptions): void {
  const { state, grimoire } = options;
  let selectedUid: number | null = null;
  let selectedPotion: number | null = null;
  let hint = options.sandbox ? 'Sandbox: use the tools at the top to try anything.' : 'Tap a card to select it.';
  let overlay: Overlay = 'none';
  const known = (recipeId: string) => !grimoire || isKnown(grimoire, recipeId);

  const render = () => {
    root.innerHTML = renderCombat(state, {
      selectedUid,
      selectedPotion,
      hint,
      overlay,
      label: options.label,
      sandbox: !!options.sandbox,
      known,
    });
  };

  /** After anything happens: learn brewed recipes, describe it, redraw, animate, save. */
  const after = (events: CombatEvent[]) => {
    const found = grimoire ? discoverFrom(grimoire, events) : [];
    hint = describeEvents(state, events);
    if (found.length) {
      hint += ` ${ICONS.grimoire} New recipe: ${found.map((id) => getRecipe(id).name).join(', ')}!`;
    }
    render();
    animate(root, events);
    options.onChange?.(state);
  };

  const tryPlay = (uid: number, targetIndex?: number) => {
    const result = playCard(state, uid, targetIndex);
    if (!result.ok) {
      hint = result.reason;
      render();
      return;
    }
    selectedUid = null;
    after(result.events);
  };

  const tryPotion = (index: number, targetIndex?: number) => {
    const result = usePotion(state, index, targetIndex);
    if (!result.ok) {
      hint = result.reason;
      render();
      return;
    }
    selectedPotion = null;
    after(result.events);
  };

  const onPotionTap = (index: number) => {
    const id = state.potions[index];
    if (id === undefined || state.status !== 'playing') return;
    selectedUid = null;
    const needsTarget = potionNeedsTarget(state, index);
    const living = state.enemies.flatMap((e, i) => (isAlive(e) ? [i] : []));
    if (selectedPotion === index) {
      if (!needsTarget) return tryPotion(index);
      if (living.length === 1) return tryPotion(index, living[0]);
    }
    selectedPotion = index;
    const recipe = getRecipe(id);
    hint = `${ICONS.potion} ${recipe.name}: ${plainText(recipe, state.weather.current, !!state.player.statuses.weak)} Free to drink. ${
      needsTarget ? (living.length === 1 ? 'Tap the enemy, or the potion again.' : 'Tap an enemy.') : 'Tap it again to drink.'
    }`;
    render();
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

    const needsTarget = cardNeedsTarget(state, card);
    const living = state.enemies.flatMap((e, i) => (isAlive(e) ? [i] : []));
    if (selectedUid === uid) {
      // Second tap plays it when the target is obvious.
      if (!needsTarget) return tryPlay(uid);
      if (living.length === 1) return tryPlay(uid, living[0]);
    }
    selectedUid = uid;
    selectedPotion = null;
    const effects = cardEffects(card);
    const brew = previewCardBrew(state, { effects });
    const overflow = state.cauldron.length >= state.cauldronSlots && effects.some((e) => e.type === 'addElement');
    const what = !brew
      ? ''
      : known(brew.recipe.id)
        ? `${brew.recipe.name}: ${plainText(brew.recipe, state.weather.current, !!state.player.statuses.weak)}`
        : 'an unknown recipe!';
    const brewNote = brew ? `${overflow ? 'Cauldron full! First brews' : 'Brews'} ${what} ` : '';
    hint =
      brewNote +
      (needsTarget
        ? living.length === 1
          ? 'Tap the enemy, or tap the card again.'
          : 'Tap an enemy.'
        : 'Tap the card again to play it.');
    render();
  };

  const onEnemyTap = (index: number) => {
    if (selectedPotion !== null) {
      if (potionNeedsTarget(state, selectedPotion)) tryPotion(selectedPotion, index);
      return;
    }
    if (selectedUid === null) return;
    const card = state.hand.find((c) => c.uid === selectedUid);
    if (card && cardNeedsTarget(state, card)) tryPlay(card.uid, index);
  };

  const onEndTurn = () => {
    selectedUid = null;
    selectedPotion = null;
    after(endTurn(state));
  };

  root.onclick = (event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-uid],[data-enemy],[data-action],[data-add-card],[data-potion]');
    if (!el) {
      if (selectedUid !== null || selectedPotion !== null) {
        selectedUid = null;
        selectedPotion = null;
        hint = '';
        render();
      }
      return;
    }
    if (el.dataset.uid !== undefined) onCardTap(Number(el.dataset.uid));
    else if (el.dataset.potion !== undefined) onPotionTap(Number(el.dataset.potion));
    else if (el.dataset.enemy !== undefined) onEnemyTap(Number(el.dataset.enemy));
    else if (el.dataset.action === 'end-turn') onEndTurn();
    else if (el.dataset.action === 'forecast') {
      selectedUid = null;
      hint = describeForecast(state);
      render();
    }
    else if (el.dataset.action === 'recipes' || el.dataset.action === 'cards') {
      overlay = el.dataset.action;
      render();
    } else if (el.dataset.action === 'close') {
      overlay = 'none';
      render();
    } else if (el.dataset.addCard !== undefined) {
      hint = sandboxAddCard(state, el.dataset.addCard) ? `Added ${getCard(el.dataset.addCard).name}.` : 'Your hand is full.';
      overlay = 'none';
      render();
    } else if (el.dataset.action === 'weather') {
      const next = WEATHER_IDS[(WEATHER_IDS.indexOf(state.weather.current) + 1) % WEATHER_IDS.length] ?? 'clear';
      after(sandboxSetWeather(state, next));
    } else if (el.dataset.action === 'energy') {
      sandboxRefillEnergy(state);
      hint = 'Energy refilled.';
      render();
    } else if (el.dataset.action === 'next-enemy') {
      root.onclick = null;
      options.sandbox?.onNextEnemy();
    } else if (el.dataset.action === 'continue') {
      root.onclick = null;
      options.onFinished(state);
    } else if (el.dataset.action === 'exit') {
      root.onclick = null;
      options.onExit();
    }
  };

  render();
}

interface CombatUi {
  selectedUid: number | null;
  selectedPotion: number | null;
  hint: string;
  overlay: Overlay;
  label: string | undefined;
  sandbox: boolean;
  known: (recipeId: string) => boolean;
}

function renderCombat(state: CombatState, ui: CombatUi): string {
  const { selectedUid, hint } = ui;
  const selected = state.hand.find((c) => c.uid === selectedUid);
  const targeting =
    (selected !== undefined && cardNeedsTarget(state, selected)) ||
    (ui.selectedPotion !== null && potionNeedsTarget(state, ui.selectedPotion));
  const { player } = state;

  return `
    <main class="combat" style="--weather-color: ${WEATHERS[state.weather.current].color}">
      <header class="top-bar">
        <span>${ui.label ? `${esc(ui.label)} · ` : ''}Turn ${state.turn}</span>
        ${ui.sandbox ? renderSandboxTools() : ''}
        ${renderPotions(state, ui.selectedPotion)}
        <button class="text-button" data-action="exit">Quit</button>
      </header>

      ${renderForecast(state)}

      <section class="enemies">
        ${state.enemies.map((e, i) => renderEnemy(e, i, targeting, state.weather.current)).join('')}
      </section>

      ${renderCauldron(state, ui.known)}

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

      <section class="hand" aria-label="Hand" style="--n: ${state.hand.length}">
        ${state.hand.map((c) => renderCard(state, c, c.uid === selectedUid)).join('')}
      </section>

      <footer class="controls">
        <span class="pile" title="Draw pile">${ICONS.drawPile} ${state.drawPile.length}</span>
        <button class="primary-button" data-action="end-turn" ${state.status === 'playing' ? '' : 'disabled'}>
          End turn
        </button>
        <span class="pile" title="Discard pile">${ICONS.discardPile} ${state.discardPile.length}</span>
      </footer>

      ${ui.overlay === 'recipes' ? renderRecipeBook(state, ui.known) : ''}
      ${ui.overlay === 'cards' ? renderCardPicker() : ''}
      ${state.status === 'playing' ? '' : renderResult(state, ui.sandbox)}
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
      ? `${ICONS.attack} ${enemyAttackDamage(enemy, move, attackWeather)}${move.element === 'fire' ? ICONS.burn : ''}`
      : '',
    move.block ? `${ICONS.block} ${move.block}` : '',
    move.status ? `${ICONS[move.status.status]} ${move.status.amount}` : '',
  ].filter(Boolean);
  const weathered = WEATHER_IDS.filter((w) => isWeathered(enemy, w));
  return `
    <button class="enemy unit ${targeting ? 'targetable' : ''}" data-enemy="${index}" data-unit="enemy-${index}"
      aria-label="${esc(enemy.name)}, ${enemy.hp} HP">
      <span class="intent ${intentParts.length ? '' : 'idle'}" title="Next: ${esc(move.name)}">${intentParts.join(' ') || esc(move.name)}</span>
      <span class="enemy-body" style="--unit-color: ${look.color}">${look.icon}</span>
      <span class="unit-name">
        ${esc(enemy.name)}
        ${
          weathered.length
            ? `<span class="weathered" title="Weathered: ignores harmful effects of ${weathered.map((w) => WEATHER_INFO[w].name).join(', ')}">${weathered.map((w) => WEATHERS[w].icon).join('')}</span>`
            : ''
        }
      </span>
      ${renderHpBar(enemy)}
    </button>
  `;
}

function renderHpBar(unit: Combatant): string {
  const { hp, maxHp, block } = unit;
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const burn = unit.statuses.burn ?? 0;
  const weak = unit.statuses.weak ?? 0;
  return `
    <span class="hp-row">
      ${block > 0 ? `<span class="block-badge" title="Block">${ICONS.block} ${block}</span>` : ''}
      ${burn > 0 ? `<span class="burn-badge" title="Burn: lose ${burn} HP at end of turn">${ICONS.burn} ${burn}</span>` : ''}
      ${weak > 0 ? `<span class="weak-badge" title="Weak: deals 25% less attack damage for ${weak} turn${weak === 1 ? '' : 's'}">${ICONS.weak} ${weak}</span>` : ''}
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
  return cardFace(def, state.weather.current, {
    className: `${selected ? 'selected' : ''} ${playable ? '' : 'unplayable'}`,
    attrs: `data-uid="${card.uid}"`,
    weak: !!state.player.statuses.weak,
    infusion: card.infusion,
  });
}

/** A card as a button. Also used on the map screens (rewards, shop, deck). */
export function cardFace(
  def: CardDef,
  weather: WeatherId,
  options: { className?: string; attrs?: string; weak?: boolean; infusion?: ElementId | undefined } = {},
): string {
  const added = def.effects.find((e) => e.type === 'addElement');
  const element = added?.type === 'addElement' ? added.element : undefined;
  const { infusion } = options;
  const infusionText = infusion ? ` Add ${ELEMENTS[infusion].icon}.` : '';
  return `
    <button class="card ${infusion ? 'infused' : ''} ${options.className ?? ''}" ${options.attrs ?? ''}
      style="--card-color: ${CARD_KIND_COLORS[def.kind]}"
      aria-label="${esc(def.name)}, costs ${def.cost}. ${esc(plainText(def, weather, options.weak) + infusionText)}">
      <span class="card-cost">${def.cost}</span>
      ${element ? `<span class="card-element" style="--chip-color: ${ELEMENTS[element].color}">${ELEMENTS[element].icon}</span>` : ''}
      ${infusion ? `<span class="card-infusion" style="--chip-color: ${ELEMENTS[infusion].color}" title="Infused">${ELEMENTS[infusion].icon}</span>` : ''}
      <span class="card-name">${esc(def.name)}</span>
      <span class="card-icon">${CARD_ICONS[def.id] ?? (def.kind === 'attack' ? ICONS.attack : ICONS.block)}</span>
      <span class="card-text">${richText(def, weather, options.weak)}${infusionText}</span>
    </button>
  `;
}

function renderSandboxTools(): string {
  return `
    <span class="sandbox-tools">
      <button class="tool-button" data-action="cards" title="Add a card">＋🃏</button>
      <button class="tool-button" data-action="weather" title="Next weather">🌦️</button>
      <button class="tool-button" data-action="energy" title="Refill energy">${ICONS.energy}</button>
      <button class="tool-button" data-action="next-enemy" title="Next enemy">👾</button>
    </span>
  `;
}

function renderCardPicker(): string {
  const row = (def: CardDef) => `
    <li><button class="picker-row" data-add-card="${esc(def.id)}">
      <span class="picker-icon">${CARD_ICONS[def.id] ?? (def.kind === 'attack' ? ICONS.attack : ICONS.block)}</span>
      <span class="recipe-body"><strong>${esc(def.name)}</strong> (${def.cost}) ${richText(def, 'clear')}</span>
    </button></li>`;
  return `
    <span class="overlay" data-action="close">
      <span class="recipe-panel" role="dialog" aria-label="Add a card" data-action="none">
        <span class="recipe-header">
          <h2>Add a card</h2>
          <button class="text-button" data-action="close">Close</button>
        </span>
        <ul class="recipe-list">${Object.values(CARDS).map(row).join('')}</ul>
      </span>
    </span>
  `;
}

function elementChip(element: ElementId, extraClass = ''): string {
  const look = ELEMENTS[element];
  return `<span class="slot filled ${extraClass}" style="--chip-color: ${look.color}" title="${esc(look.name)}">${look.icon}</span>`;
}

function renderPotions(state: CombatState, selected: number | null): string {
  if (state.potions.length === 0) return '';
  return `
    <span class="potion-belt" aria-label="Potions">
      ${state.potions
        .map((id, i) => {
          const recipe = getRecipe(id);
          return `<button class="potion ${selected === i ? 'selected' : ''}" data-potion="${i}" title="${esc(recipe.name)}">
            ${ICONS.potion}<small>${recipe.elements.map((e) => ELEMENTS[e].icon).join('')}</small></button>`;
        })
        .join('')}
    </span>
  `;
}

/** The cauldron's slots, the weather's free element, and what brewing now would make. */
function renderCauldron(state: CombatState, known: (recipeId: string) => boolean): string {
  const weather = state.weather.current;
  const free = WEATHER_ELEMENTS[weather];
  const slots = Array.from({ length: state.cauldronSlots }, (_, i) => {
    const element = state.cauldron[i];
    return element ? elementChip(element) : '<span class="slot empty"></span>';
  }).join('');
  let preview = 'Gather elements, then Stir to brew. Tap for recipes.';
  if (state.cauldron.length > 0) {
    const brew = findBrew(state.cauldron, weather);
    preview = known(brew.recipe.id)
      ? `Stir now: <strong>${esc(brew.recipe.name)}</strong> · ${richText(brew.recipe, weather, !!state.player.statuses.weak)}`
      : 'Stir now: <strong>???</strong> · an unknown recipe. Brew it to learn it!';
  }
  if (state.bottleNext > 0) preview += ` <strong>${ICONS.potion} The next brew will be bottled.</strong>`;
  return `
    <button class="cauldron" data-action="recipes" aria-label="Cauldron. Tap to see recipes.">
      <span class="cauldron-row">
        <span class="cauldron-icon">${ICONS.cauldron}</span>
        <span class="slots">${slots}</span>
        ${
          free
            ? `<span class="free-element" title="${esc(WEATHER_INFO[weather].name)} adds ${esc(ELEMENTS[free].name)} to every brew">+${elementChip(free, 'free')}</span>`
            : ''
        }
        <span class="book-icon">${ICONS.recipes}</span>
      </span>
      <span class="brew-preview">${preview}</span>
    </button>
  `;
}

function renderRecipeBook(state: CombatState, known: (recipeId: string) => boolean): string {
  const weather = state.weather.current;
  const row = (r: RecipeDef) =>
    known(r.id)
      ? `
    <li class="recipe">
      <span class="recipe-elements">${r.elements.map((e) => ELEMENTS[e].icon).join('')}</span>
      <span class="recipe-body"><strong>${esc(r.name)}</strong> ${richText(r, weather, !!state.player.statuses.weak)}</span>
    </li>`
      : `
    <li class="recipe unknown">
      <span class="recipe-elements">${r.elements.map(() => '❔').join('')}</span>
      <span class="recipe-body"><strong>???</strong> Not discovered yet.</span>
    </li>`;
  const discovered = RECIPES.filter((r) => known(r.id)).length;
  const free = WEATHER_ELEMENTS[weather];
  return `
    <span class="overlay" data-action="close">
      <span class="recipe-panel" role="dialog" aria-label="Recipes" data-action="none">
        <span class="recipe-header">
          <h2>Recipes <small class="muted">${discovered}/${RECIPES.length}</small></h2>
          <button class="text-button" data-action="close">Close</button>
        </span>
        <span class="recipe-rules">
          Order doesn't matter. Stir brews the biggest recipe you can make, oldest elements first; the rest stay.
          The cauldron holds ${state.cauldronSlots}; adding another brews it first.
          Each weather adds its element to every brew${free ? ` (now: ${ELEMENTS[free].icon} from ${esc(WEATHER_INFO[weather].name)})` : ''}.
          No match makes Sludge (${esc(SLUDGE.text)})
        </span>
        <ul class="recipe-list">${RECIPES.map(row).join('')}</ul>
      </span>
    </span>
  `;
}

function renderResult(state: CombatState, sandbox: boolean): string {
  const won = state.status === 'won';
  return `
    <span class="overlay">
      <span class="result-panel">
        <h2>${won ? 'Victory!' : 'Defeated'}</h2>
        <p>${won ? `You won in ${state.turn} turn${state.turn === 1 ? '' : 's'}.` : 'The storm got the better of you.'}</p>
        <button class="primary-button" data-action="continue">${sandbox ? 'Reset' : 'Continue'}</button>
      </span>
    </span>
  `;
}

function renderForecast(state: CombatState): string {
  const { current, forecast } = state.weather;
  const next = forecast[0];
  const after = hasRelic(state, 'barometer') ? forecast[1] : undefined;
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
              <span class="forecast-icons">
                <span class="forecast-icon">${WEATHERS[next].icon}</span>
                ${after ? `<span class="forecast-icon later" title="Then (Barometer)">${WEATHERS[after].icon}</span>` : ''}
              </span>
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
    } else if (event.type === 'potion') {
      messages.push(`${ICONS.potion} You drank ${getRecipe(event.recipeId).name}!`);
    } else if (event.type === 'brew' && event.bottled) {
      messages.push(`${ICONS.potion} Bottled ${getRecipe(event.recipeId).name} for later!`);
    } else if (event.type === 'brew') {
      const recipe = getRecipe(event.recipeId);
      const used = event.used.map((e) => ELEMENTS[e].icon).join('');
      const free = event.weatherElement ? ` + ${ELEMENTS[event.weatherElement].icon} from the weather` : '';
      messages.push(
        recipe.id === SLUDGE.id
          ? `${ICONS.cauldron} ${used} made Sludge.`
          : `${ICONS.cauldron} ${used}${free} → ${recipe.name}!`,
      );
    } else if (event.type === 'damage' && event.source === 'lightning') {
      const name = event.target.side === 'player' ? 'you' : (state.enemies[event.target.index]?.name ?? 'an enemy');
      messages.push(`${ICONS.lightning} Lightning struck ${name}!`);
    } else if (event.type === 'steal') {
      const name = state.enemies[event.index]?.name ?? 'An enemy';
      messages.push(`${name} stole ${ELEMENTS[event.element].icon} from your cauldron!`);
    } else if (event.type === 'relic') {
      messages.push(`${RELIC_ICONS[event.relic] ?? ''} ${getRelic(event.relic).name}!`);
    }
  }
  return messages.join(' ');
}

interface HasText {
  effects: readonly Effect[];
  text: string;
}

/** The damage of the first damage effect, before and after weather and the player's Weak. */
function damageNumbers(item: HasText, weather: WeatherId, weak = false): { base: number; now: number } | null {
  const effect = item.effects.find((e) => e.type === 'damage');
  if (!effect || effect.type !== 'damage') return null;
  const modified = modifyDamage(effect.amount, effect.element, weather);
  return { base: effect.amount, now: weak ? Math.floor(modified * WEAK_MULTIPLIER) : modified };
}

/** Card or recipe text with `{damage}` filled in. */
function plainText(item: HasText, weather: WeatherId, weak = false): string {
  return item.text.replace('{damage}', String(damageNumbers(item, weather, weak)?.now ?? ''));
}

/** Like plainText, as HTML, with damage changed by weather or Weak highlighted. */
function richText(item: HasText, weather: WeatherId, weak = false): string {
  const damage = damageNumbers(item, weather, weak);
  if (!damage || !item.text.includes('{damage}')) return esc(plainText(item, weather, weak));
  const [before = '', after = ''] = esc(item.text).split('{damage}');
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
    if (event.type === 'brew') {
      const cauldron = root.querySelector<HTMLElement>('.cauldron');
      flash(cauldron, 'brewed');
      if (cauldron) floatText(cauldron, getRecipe(event.recipeId).name, 'brew');
      continue;
    }
    if (event.type === 'heal') {
      const player = root.querySelector<HTMLElement>('[data-unit="player"]');
      if (player && event.amount > 0) floatText(player, `+${event.amount}`, 'heal');
      continue;
    }
    if (event.type === 'steal') {
      const cauldron = root.querySelector<HTMLElement>('.cauldron');
      flash(cauldron, 'hit');
      if (cauldron) floatText(cauldron, `-${ELEMENTS[event.element].icon}`, 'damage');
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

function floatText(parent: HTMLElement, text: string, className: string): void {
  const float = document.createElement('span');
  float.className = `float ${className}`;
  float.textContent = text;
  parent.appendChild(float);
  float.addEventListener('animationend', () => float.remove());
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
