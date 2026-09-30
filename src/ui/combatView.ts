import { WEATHER_ELEMENTS, findBrew } from '../core/brewing';
import {
  WEAK_MULTIPLIER,
  cannotPlayReason,
  cardEffects,
  cardNeedsTarget,
  canTakeCover,
  hasRelic,
  currentIntent,
  endTurn,
  enemyAttackDamage,
  enemyBrewPreview,
  enemyMoveBlock,
  isAlive,
  isAttuned,
  isSheltered,
  isWeathered,
  playCard,
  potionNeedsTarget,
  previewCardBrew,
  toggleExposure,
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
import { WEATHER_IDS, modifyDamage, skyWeather, turnsUntilChange } from '../core/weather';
import { CARDS, getCard } from '../data/cards';
import { DISTILLED_CARDS } from '../data/distilled';
import { getEnemy } from '../data/enemies';
import { RECIPES, SLUDGE, getRecipe } from '../data/recipes';
import { getSkyCard } from '../data/sky';
import { listOf, t } from '../i18n';
import {
  cardName,
  cardText,
  elementName,
  enemyName,
  moveName,
  recipeName,
  recipeText,
  relicName,
  skyName,
  weatherEffect,
  weatherName,
} from '../i18n/content';
import { esc } from './dom';
import { combatFeedback } from './feedback';
import { playSfx } from './sound';
import { CARD_KIND_COLORS, cardIcon, ELEMENTS, ENEMY_LOOKS, ICONS, RELIC_ICONS, WEATHERS } from './theme';
import { flashSky, motionAllowed, setWeatherFx } from './weatherFx';

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
  let hint = t(options.sandbox ? 'combat.hintSandbox' : 'combat.hintStart');
  let overlay: Overlay = 'none';
  const known = (recipeId: string) => !grimoire || isKnown(grimoire, recipeId);
  /** Cards in hand at the last render (and its turn), so newly drawn ones can slide in. */
  let shownHand = new Set<number>();
  let shownTurn = 0;
  let entering = true;
  let wasPlaying = state.status === 'playing';

  const render = () => {
    // A new turn's hand is all new, even a card that was in the last hand.
    const fresh = state.hand.map((c) => c.uid).filter((uid) => state.turn !== shownTurn || !shownHand.has(uid));
    shownHand = new Set(state.hand.map((c) => c.uid));
    shownTurn = state.turn;
    setWeatherFx(state.weather.current);
    root.innerHTML = renderCombat(state, {
      selectedUid,
      selectedPotion,
      hint,
      overlay,
      label: options.label,
      sandbox: !!options.sandbox,
      known,
      fresh,
      entering,
    });
    entering = false;
  };

  /** After anything happens: learn brewed recipes, describe it, redraw, animate, play sounds, save. */
  const after = (events: CombatEvent[]) => {
    const found = grimoire ? discoverFrom(grimoire, events) : [];
    hint = describeEvents(state, events);
    if (found.length) {
      hint += ` ${ICONS.grimoire} ${t('combat.newRecipe', { names: listOf(found.map(recipeName)) })}`;
    }
    render();
    animate(root, events);
    combatFeedback(events, state, wasPlaying);
    wasPlaying = state.status === 'playing';
    options.onChange?.(state);
  };

  const tryPlay = (uid: number, targetIndex?: number) => {
    const card = state.hand.find((c) => c.uid === uid);
    const ghost = captureCard(root, uid);
    const intoCauldron =
      card !== undefined &&
      cardEffects(card, state.weather.current).some((e) => e.type === 'addElement' || e.type === 'brew' || e.type === 'catchWeather');
    const result = playCard(state, uid, targetIndex);
    if (!result.ok) {
      playSfx('deny');
      hint = result.reason;
      render();
      return;
    }
    selectedUid = null;
    playSfx('card');
    after(result.events);
    const target =
      targetIndex !== undefined ? `[data-unit="enemy-${targetIndex}"]` : intoCauldron ? '.cauldron' : '[data-unit="player"]';
    if (ghost) flyGhost(ghost, root.querySelector(target));
  };

  const tryPotion = (index: number, targetIndex?: number) => {
    const result = usePotion(state, index, targetIndex);
    if (!result.ok) {
      playSfx('deny');
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
    playSfx('select');
    const text = plainText(recipeItem(id), state.weather.current, !!state.player.statuses.weak);
    const how = needsTarget ? (living.length === 1 ? 'combat.tapEnemyOrPotion' : 'combat.tapEnemy') : 'combat.tapPotionAgain';
    hint = `${ICONS.potion} ${t('combat.potionHint', { name: recipeName(id), text })} ${t(how)}`;
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
      playSfx('deny');
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
    playSfx('select');
    const effects = cardEffects(card, state.weather.current);
    const brew = previewCardBrew(state, { effects });
    const addsElement = effects.some(
      (e) => e.type === 'addElement' || (e.type === 'catchWeather' && WEATHER_ELEMENTS[state.weather.current]),
    );
    const overflow = state.cauldron.length >= state.cauldronSlots && addsElement;
    const what = !brew
      ? ''
      : alembicGamble(state, brew.recipe)
        ? t('combat.alembicBrew')
        : known(brew.recipe.id)
          ? `${recipeName(brew.recipe.id)}: ${plainText(recipeItem(brew.recipe.id), state.weather.current, !!state.player.statuses.weak)}`
          : t('combat.unknownBrew');
    const brewNote = brew ? `${t(overflow ? 'combat.overflowBrews' : 'combat.brews', { what })} ` : '';
    hint =
      brewNote +
      t(needsTarget ? (living.length === 1 ? 'combat.tapEnemyOrCard' : 'combat.tapEnemy') : 'combat.tapCardAgain');
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
    playSfx('endTurn');
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
    if ((el.dataset.action && el.dataset.action !== 'end-turn') || el.dataset.addCard !== undefined) playSfx('tap');
    if (el.dataset.uid !== undefined) onCardTap(Number(el.dataset.uid));
    else if (el.dataset.potion !== undefined) onPotionTap(Number(el.dataset.potion));
    else if (el.dataset.enemy !== undefined) onEnemyTap(Number(el.dataset.enemy));
    else if (el.dataset.action === 'end-turn') onEndTurn();
    else if (el.dataset.action === 'exposure') {
      if (canTakeCover(state)) after(toggleExposure(state));
      else {
        hint = `${RELIC_ICONS.stormVow} ${t('combat.noCover')}`;
        render();
      }
    }
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
      hint = sandboxAddCard(state, el.dataset.addCard)
        ? t('combat.addedCard', { name: cardName(getCard(el.dataset.addCard)) })
        : t('combat.handFull');
      overlay = 'none';
      render();
    } else if (el.dataset.action === 'weather') {
      const next = WEATHER_IDS[(WEATHER_IDS.indexOf(state.weather.current) + 1) % WEATHER_IDS.length] ?? 'clear';
      after(sandboxSetWeather(state, next));
    } else if (el.dataset.action === 'energy') {
      sandboxRefillEnergy(state);
      hint = t('combat.energyRefilled');
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
  /** Cards drawn since the last render (they slide in). */
  fresh: readonly number[];
  /** The fight's first render (the screen fades in). */
  entering: boolean;
}

function renderCombat(state: CombatState, ui: CombatUi): string {
  const { selectedUid, hint } = ui;
  const selected = state.hand.find((c) => c.uid === selectedUid);
  const targeting =
    (selected !== undefined && cardNeedsTarget(state, selected)) ||
    (ui.selectedPotion !== null && potionNeedsTarget(state, ui.selectedPotion));
  const { player } = state;

  return `
    <main class="combat ${ui.entering ? 'enter' : ''}" style="--weather-color: ${WEATHERS[state.weather.current].color}">
      <header class="top-bar">
        <span>${ui.label ? `${esc(ui.label)} · ` : ''}${esc(t('combat.turn', { turn: state.turn }))}</span>
        ${ui.sandbox ? renderSandboxTools() : ''}
        ${renderPotions(state, ui.selectedPotion)}
        <button class="text-button" data-action="exit">${esc(t('common.quit'))}</button>
      </header>

      ${renderForecast(state)}

      <section class="enemies">
        ${state.enemies.map((e, i) => renderEnemy(e, i, targeting, state, ui.known)).join('')}
      </section>

      ${renderCauldron(state, ui.known)}

      <p class="hint" aria-live="polite"><span>${esc(hint)}</span></p>

      <section class="player unit" data-unit="player">
        <span class="energy" title="${esc(t('combat.energy'))}">
          <span class="energy-value">${player.energy}/${player.maxEnergy}</span>
        </span>
        <span class="player-stats">
          <span class="unit-name">${esc(t('combat.you'))}</span>
          ${renderHpBar(player)}
        </span>
      </section>

      <section class="hand" aria-label="${esc(t('combat.hand'))}" style="--n: ${state.hand.length}">
        ${state.hand.map((c) => renderCard(state, c, c.uid === selectedUid, ui.fresh.indexOf(c.uid))).join('')}
      </section>

      <footer class="controls">
        <span class="pile" title="${esc(t('combat.drawPile'))}">${ICONS.drawPile} ${state.drawPile.length}</span>
        <button class="stance ${player.exposed ? 'out' : 'cover'} ${canTakeCover(state) ? '' : 'locked'}" data-action="exposure"
          aria-label="${esc(t(player.exposed ? 'combat.outAria' : 'combat.coverAria'))}">
          <span>${player.exposed ? WEATHERS[state.weather.current].icon : ICONS.cover}</span>
          <small>${esc(t(player.exposed ? 'combat.out' : 'combat.cover'))}</small>
        </button>
        <button class="primary-button" data-action="end-turn" ${state.status === 'playing' ? '' : 'disabled'}>
          ${esc(t('combat.endTurn'))}
        </button>
        <span class="pile" title="${esc(t('combat.discardPile'))}">${ICONS.discardPile} ${state.discardPile.length}</span>
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
  state: CombatState,
  known: (recipeId: string) => boolean,
): string {
  const weather = state.weather.current;
  const exposed = state.player.exposed;
  const look = ENEMY_LOOKS[enemy.defId] ?? { icon: '👾', color: '#888' };
  const name = enemyName(enemy.defId);
  if (!isAlive(enemy)) {
    return `<span class="enemy unit defeated" data-unit="enemy-${index}">
      <span class="enemy-body" style="--unit-color: ${look.color}">💨</span>
      <span class="unit-name">${esc(name)}</span>
    </span>`;
  }
  const move = currentIntent(enemy);
  // An enemy's own weather move happens before its attack, so preview damage in that weather.
  const attackWeather = move.weather ?? weather;
  const block = enemyMoveBlock(move, attackWeather);
  // A hunter's dive shows its bonus while you're out in the open.
  const hunting = exposed && move.exposedBonus ? ICONS.hunter : '';
  const hits = (move.hits ?? 1) > 1 ? `×${move.hits}` : '';
  const intentParts = [
    move.weather ? WEATHERS[move.weather].icon : '',
    move.shatter ? ICONS.shatter : '',
    move.damage
      ? `${ICONS.attack} ${enemyAttackDamage(enemy, move, attackWeather, exposed)}${hits}${move.element === 'fire' ? ICONS.burn : ''}${hunting}`
      : '',
    block ? `${ICONS.block} ${block}` : '',
    move.heal ? `${ICONS.heal} ${move.heal}` : '',
    move.status ? `${ICONS[move.status.status]} ${move.status.amount}` : '',
    move.stealElement ? ICONS.steal : '',
  ].filter(Boolean);
  // A brew fills up at the end of this turn: show its damage in the intent too.
  const brewing = enemyBrewPreview(enemy);
  const brewDamage = brewing?.effects.find((e) => e.type === 'damage');
  if (brewing && brewDamage?.type === 'damage') {
    const amount = enemyAttackDamage(enemy, { name: 'brew', damage: brewDamage.amount, element: brewDamage.element }, attackWeather);
    intentParts.push(`${ICONS.cauldron} ${amount}`);
  } else if (brewing) intentParts.push(ICONS.cauldron);
  const weathered = WEATHER_IDS.filter((w) => isWeathered(enemy, w));
  const def = getEnemy(enemy.defId);
  const hunter = [...def.moves, ...(def.phase2?.moves ?? [])].some((m) => m.exposedBonus);
  return `
    <button class="enemy unit ${targeting ? 'targetable' : ''}" data-enemy="${index}" data-unit="enemy-${index}"
      aria-label="${esc(t('combat.enemyAria', { name, hp: enemy.hp }))}">
      <span class="intent ${intentParts.length ? '' : 'idle'}" title="${esc(t('combat.nextMove', { move: moveName(move.name) }))}">${intentParts.join(' ') || esc(moveName(move.name))}</span>
      <span class="enemy-body" style="--unit-color: ${look.color}">${look.icon}</span>
      <span class="unit-name">
        ${esc(name)}
        ${
          weathered.length
            ? `<span class="weathered" title="${esc(t('combat.weathered', { weathers: weathered.map(weatherName).join(', ') }))}">${weathered.map((w) => WEATHERS[w].icon).join('')}</span>`
            : ''
        }
        ${isSheltered(enemy) ? `<span class="weathered" title="${esc(t('combat.sheltered'))}">${ICONS.cover}</span>` : ''}
        ${hunter ? `<span class="weathered" title="${esc(t('combat.hunter'))}">${ICONS.hunter}</span>` : ''}
      </span>
      ${renderEnemyCauldron(enemy, brewing, known)}
      ${renderHpBar(enemy)}
    </button>
  `;
}

/** A brewing enemy's small cauldron, and what it will brew this turn. */
function renderEnemyCauldron(enemy: EnemyState, brewing: RecipeDef | null, known: (recipeId: string) => boolean): string {
  const size = getEnemy(enemy.defId).cauldron?.size;
  if (!size) return '';
  const slots = Array.from({ length: size }, (_, i) => {
    const element = enemy.cauldron[i];
    return element
      ? `<span class="mini-slot" style="--chip-color: ${ELEMENTS[element].color}">${ELEMENTS[element].icon}</span>`
      : '<span class="mini-slot empty"></span>';
  }).join('');
  const note = enemy.spoiled
    ? `${ICONS.spoiled} ${esc(t('combat.spoiled'))}`
    : brewing
      ? esc(t('combat.enemyBrews', { name: known(brewing.id) ? recipeName(brewing.id) : '???' }))
      : '';
  return `<span class="enemy-cauldron" title="${esc(t('combat.enemyCauldron'))}">${ICONS.cauldron}${slots}<small>${note}</small></span>`;
}

function renderHpBar(unit: Combatant): string {
  const { hp, maxHp, block } = unit;
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const burn = unit.statuses.burn ?? 0;
  const weak = unit.statuses.weak ?? 0;
  return `
    <span class="hp-row">
      ${block > 0 ? `<span class="block-badge" title="${esc(t('combat.block'))}">${ICONS.block} ${block}</span>` : ''}
      ${burn > 0 ? `<span class="burn-badge" title="${esc(t('combat.burnTitle', { n: burn }))}">${ICONS.burn} ${burn}</span>` : ''}
      ${weak > 0 ? `<span class="weak-badge" title="${esc(weak === 1 ? t('combat.weakTitle1') : t('combat.weakTitle', { n: weak }))}">${ICONS.weak} ${weak}</span>` : ''}
      <span class="hp-bar ${block > 0 ? 'has-block' : ''}">
        <span class="hp-fill" style="width: ${pct}%"></span>
        <span class="hp-text">${hp}/${maxHp}</span>
      </span>
    </span>
  `;
}

/** A card in hand. `drawOrder` ≥ 0 for a card just drawn: it slides in, one after another. */
function renderCard(state: CombatState, card: CardInstance, selected: boolean, drawOrder: number): string {
  const def = getCard(card.defId);
  const playable = cannotPlayReason(state, card) === null;
  return cardFace(def, state.weather.current, {
    className: `${selected ? 'selected' : ''} ${playable ? '' : 'unplayable'} ${drawOrder >= 0 ? 'drawn' : ''}`,
    attrs: `data-uid="${card.uid}"`,
    style: drawOrder >= 0 ? `--i: ${drawOrder}` : undefined,
    weak: !!state.player.statuses.weak,
    infusion: card.infusion,
    attuned: isAttuned(def.id, state.weather.current),
  });
}

/**
 * Roughly how wide a name's longest word is in bold text, in em. Card names
 * shrink to fit it (see .card-name) instead of breaking inside the word.
 */
function longestWordEm(name: string): number {
  const width = (ch: string) =>
    /[\u3131-\uD7A3]/.test(ch)
      ? 0.95
      : /[iljI.,'!]/.test(ch)
        ? 0.32
        : /[ftr]/.test(ch)
          ? 0.45
          : /[mwMW]/.test(ch)
            ? 0.95
            : /[A-Z]/.test(ch)
              ? 0.72
              : 0.62;
  return Math.max(...name.split(/\s+/).map((word) => [...word].reduce((sum, ch) => sum + width(ch), 0) * 1.2));
}

/** A card as a button. Also used on the map screens (rewards, shop, deck). */
export function cardFace(
  def: CardDef,
  weather: WeatherId,
  options: {
    className?: string;
    attrs?: string;
    weak?: boolean;
    infusion?: ElementId | undefined;
    note?: string;
    /** The card's Attuned bonus is active (it glows in the weather's color). */
    attuned?: boolean;
    /** Extra inline style, e.g. CSS variables for animations. */
    style?: string | undefined;
  } = {},
): string {
  const added = def.effects.find((e) => e.type === 'addElement');
  const element = added?.type === 'addElement' ? added.element : undefined;
  const { infusion } = options;
  const infusionText = infusion ? ` ${t('card.addElement', { icon: ELEMENTS[infusion].icon })}` : '';
  const attunedTo = def.attuned?.weather;
  const name = cardName(def);
  const item = cardItem(def);
  const aria = t('card.aria', { name, cost: def.cost, text: plainText(item, weather, options.weak) + infusionText });
  return `
    <button class="card ${infusion ? 'infused' : ''} ${options.attuned ? 'attuned' : ''} ${options.className ?? ''}" ${options.attrs ?? ''}
      style="--card-color: ${CARD_KIND_COLORS[def.kind]}${attunedTo ? `; --attuned-color: ${WEATHERS[attunedTo].color}` : ''}${options.style ? `; ${options.style}` : ''}"
      aria-label="${esc(aria)}${options.attuned ? ` ${esc(t('card.attunedNow'))}` : ''}">
      <span class="card-cost">${def.cost}</span>
      ${element ? `<span class="card-element" style="--chip-color: ${ELEMENTS[element].color}">${ELEMENTS[element].icon}</span>` : ''}
      ${attunedTo && !element ? `<span class="card-element card-attuned" style="--chip-color: ${WEATHERS[attunedTo].color}" title="${esc(t('card.attunedTo', { weather: weatherName(attunedTo) }))}">${WEATHERS[attunedTo].icon}</span>` : ''}
      ${infusion ? `<span class="card-infusion" style="--chip-color: ${ELEMENTS[infusion].color}" title="${esc(t('card.infused'))}">${ELEMENTS[infusion].icon}</span>` : ''}
      <span class="card-name" style="--name-em: ${longestWordEm(name).toFixed(2)}">${esc(name)}</span>
      <span class="card-icon">${cardIcon(def)}</span>
      <span class="card-text">${richText(item, weather, options.weak)}${esc(infusionText)}</span>
      ${options.note ? `<span class="card-note">${esc(options.note)}</span>` : ''}
    </button>
  `;
}

function renderSandboxTools(): string {
  return `
    <span class="sandbox-tools">
      <button class="tool-button" data-action="cards" title="${esc(t('sandbox.addCard'))}">＋🃏</button>
      <button class="tool-button" data-action="weather" title="${esc(t('sandbox.nextWeather'))}">🌦️</button>
      <button class="tool-button" data-action="energy" title="${esc(t('sandbox.refillEnergy'))}">${ICONS.energy}</button>
      <button class="tool-button" data-action="next-enemy" title="${esc(t('sandbox.nextEnemy'))}">👾</button>
    </span>
  `;
}

function renderCardPicker(): string {
  const row = (def: CardDef) => `
    <li><button class="picker-row" data-add-card="${esc(def.id)}">
      <span class="picker-icon">${cardIcon(def)}</span>
      <span class="recipe-body"><strong>${esc(cardName(def))}</strong> (${def.cost}) ${richText(cardItem(def), 'clear')}</span>
    </button></li>`;
  return `
    <span class="overlay" data-action="close">
      <span class="recipe-panel" role="dialog" aria-label="${esc(t('sandbox.addCard'))}" data-action="none">
        <span class="recipe-header">
          <h2>${esc(t('sandbox.addCard'))}</h2>
          <button class="text-button" data-action="close">${esc(t('common.close'))}</button>
        </span>
        <ul class="recipe-list">${[...Object.values(CARDS), ...Object.values(DISTILLED_CARDS)].map(row).join('')}</ul>
      </span>
    </span>
  `;
}

function elementChip(element: ElementId): string {
  const look = ELEMENTS[element];
  return `<span class="slot filled" style="--chip-color: ${look.color}" title="${esc(elementName(element))}">${look.icon}</span>`;
}

function renderPotions(state: CombatState, selected: number | null): string {
  if (state.potions.length === 0) return '';
  return `
    <span class="potion-belt" aria-label="${esc(t('combat.potions'))}">
      ${state.potions
        .map((id, i) => {
          const recipe = getRecipe(id);
          return `<button class="potion ${selected === i ? 'selected' : ''}" data-potion="${i}" title="${esc(recipeName(id))}">
            ${ICONS.potion}<small>${recipe.elements.map((e) => ELEMENTS[e].icon).join('')}</small></button>`;
        })
        .join('')}
    </span>
  `;
}

/** Whether this brew is Sludge that the Alembic will turn into a random brew. */
function alembicGamble(state: CombatState, recipe: RecipeDef): boolean {
  return recipe.id === SLUDGE.id && hasRelic(state, 'alembic');
}

/** The cauldron's slots and what brewing now would make. */
function renderCauldron(state: CombatState, known: (recipeId: string) => boolean): string {
  const weather = state.weather.current;
  const slots = Array.from({ length: state.cauldronSlots }, (_, i) => {
    const element = state.cauldron[i];
    return element ? elementChip(element) : '<span class="slot empty"></span>';
  }).join('');
  let preview = esc(t('cauldron.empty'));
  if (state.cauldron.length > 0) {
    const brew = findBrew(state.cauldron);
    const stirNow = esc(t('cauldron.stirNow'));
    preview = alembicGamble(state, brew.recipe)
      ? `${stirNow} <strong>${RELIC_ICONS.alembic} ${esc(t('cauldron.randomBrew'))}</strong> · ${esc(t('cauldron.alembicNote'))}`
      : known(brew.recipe.id)
        ? `${stirNow} <strong>${esc(recipeName(brew.recipe.id))}</strong> · ${richText(recipeItem(brew.recipe.id), weather, !!state.player.statuses.weak)}`
        : `${stirNow} <strong>???</strong> · ${esc(t('cauldron.unknown'))}`;
  }
  if (state.bottleNext > 0) preview += ` <strong>${ICONS.potion} ${esc(t('cauldron.bottled'))}</strong>`;
  if (state.doubleNext > 0) preview += ` <strong>${ICONS.double} ${esc(t('cauldron.doubled'))}</strong>`;
  return `
    <button class="cauldron" data-action="recipes" aria-label="${esc(t('cauldron.aria'))}">
      <span class="cauldron-row">
        <span class="cauldron-icon">${ICONS.cauldron}</span>
        <span class="slots">${slots}</span>
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
      <span class="recipe-body"><strong>${esc(recipeName(r.id))}</strong> ${richText(recipeItem(r.id), weather, !!state.player.statuses.weak)}</span>
    </li>`
      : `
    <li class="recipe unknown">
      <span class="recipe-elements">${r.elements.map(() => '❔').join('')}</span>
      <span class="recipe-body"><strong>???</strong> ${esc(t('recipes.unknown'))}</span>
    </li>`;
  const discovered = RECIPES.filter((r) => known(r.id)).length;
  const catches = (['rain', 'storm', 'heatwave', 'snow'] as const)
    .map((w) => {
      const element = WEATHER_ELEMENTS[w];
      return `${weatherName(w)} ${element ? ELEMENTS[element].icon : ''}`;
    })
    .join(', ');
  const rules = t('recipes.rules', { slots: state.cauldronSlots, catches, sludge: recipeText(SLUDGE.id) });
  return `
    <span class="overlay" data-action="close">
      <span class="recipe-panel" role="dialog" aria-label="${esc(t('recipes.title'))}" data-action="none">
        <span class="recipe-header">
          <h2>${esc(t('recipes.title'))} <small class="muted">${discovered}/${RECIPES.length}</small></h2>
          <button class="text-button" data-action="close">${esc(t('common.close'))}</button>
        </span>
        <span class="recipe-rules">${esc(rules)}</span>
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
        <h2>${esc(t(won ? 'result.victory' : 'result.defeat'))}</h2>
        <p>${esc(won ? (state.turn === 1 ? t('result.wonIn1') : t('result.wonIn', { turns: state.turn })) : t('result.lost'))}</p>
        <button class="primary-button" data-action="continue">${esc(t(sandbox ? 'result.reset' : 'common.continue'))}</button>
      </span>
    </span>
  `;
}

function renderForecast(state: CombatState): string {
  const { current, forecast } = state.weather;
  const next = forecast[0];
  const after = hasRelic(state, 'barometer') ? forecast[1] : undefined;
  const turns = turnsUntilChange(state.weather, state.turn);
  // The Sky Anchor holds the weather: the next one only comes when something changes it.
  const when = hasRelic(state, 'skyAnchor')
    ? `${ICONS.anchor} ${t('forecast.anchored')}`
    : turns === 1
      ? t('forecast.nextTurn')
      : t('forecast.inTurns', { n: turns });
  return `
    <button class="forecast" data-action="forecast" aria-label="${esc(t('forecast.aria'))}">
      <span class="forecast-now" style="--chip-color: ${WEATHERS[current].color}">
        <span class="forecast-icon">${WEATHERS[current].icon}</span>
        <span class="forecast-text">
          <strong>${esc(skyName(state.weather.currentCard))}</strong>
          <small>${esc(weatherEffect(current))}</small>
        </span>
      </span>
      ${
        next
          ? `<span class="forecast-next" title="${esc(t('forecast.nextWeather'))}">
              <small>${esc(when)}</small>
              <span class="forecast-icons">
                <span class="forecast-icon" title="${esc(skyName(next))}">${WEATHERS[skyWeather(next)].icon}</span>
                ${after ? `<span class="forecast-icon later" title="${esc(t('forecast.then', { name: skyName(after) }))}">${WEATHERS[skyWeather(after)].icon}</span>` : ''}
              </span>
            </span>`
          : ''
      }
    </button>
  `;
}

/** What standing out (or taking cover) means in the current weather. */
function describeExposure(state: CombatState): string {
  const weather = state.weather.current;
  const element = WEATHER_ELEMENTS[weather];
  if (!state.player.exposed) return `${ICONS.cover} ${t('exposure.cover')}`;
  if (!element) return t('exposure.outClear', { weather: weatherName(weather) });
  const harm = weather === 'storm' ? ` ${t('exposure.lightning')}` : weather === 'heatwave' ? ` ${t('exposure.burn')}` : '';
  const out = t('exposure.out', { weather: weatherName(weather), icon: ELEMENTS[element].icon, element: elementName(element) });
  return out + harm;
}

function describeForecast(state: CombatState): string {
  const { current, forecast } = state.weather;
  const next = forecast[0];
  const turns = turnsUntilChange(state.weather, state.turn);
  const now = `${weatherName(current)}: ${weatherEffect(current)}`;
  const change = hasRelic(state, 'skyAnchor')
    ? ` ${ICONS.anchor} ${t('forecast.anchoredLong')}`
    : next
      ? ` ${turns === 1 ? t('forecast.next1', { sky: describeSkyCard(next) }) : t('forecast.next', { sky: describeSkyCard(next), n: turns })}`
      : '';
  return `${now}${change} ${describeExposure(state)} ${ICONS.sky} ${t('forecast.sky', { summary: summarizeSky(state.weather.skyDeck) })}`;
}

/** "Monsoon (Rain, 5 turns)" or just "Storm" for a basic card. */
function describeSkyCard(id: string): string {
  const card = getSkyCard(id);
  const name = skyName(id);
  const weather = weatherName(card.weather);
  return name === weather ? weather : t('sky.cardDetail', { name, weather, turns: card.turns });
}

/** "2 Storm, 1 Rain, …" */
export function summarizeSky(sky: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const id of sky) counts.set(skyName(id), (counts.get(skyName(id)) ?? 0) + 1);
  return [...counts].map(([name, n]) => t('sky.count', { n, name })).join(', ');
}

/** A short message about the most important thing that just happened. */
function describeEvents(state: CombatState, events: CombatEvent[]): string {
  const messages: string[] = [];
  const enemy = (index: number) => {
    const found = state.enemies[index];
    return found ? enemyName(found.defId) : t('ev.anEnemy');
  };
  const element = (e: ElementId) => ({ icon: ELEMENTS[e].icon, element: elementName(e) });
  let actingEnemy = t('ev.anEnemy');
  for (const event of events) {
    if (event.type === 'enemyMove') {
      actingEnemy = enemy(event.index);
    } else if (event.type === 'weather') {
      const weather = weatherName(event.to);
      const what =
        event.cause === 'schedule'
          ? t('ev.weatherSchedule', { weather })
          : event.cause === 'enemy'
            ? t('ev.weatherEnemy', { enemy: actingEnemy, weather })
            : t('ev.weatherPlayer', { weather });
      messages.push(`${WEATHERS[event.to].icon} ${what} ${weatherEffect(event.to)}`);
    } else if (event.type === 'potion') {
      messages.push(`${ICONS.potion} ${t('ev.potion', { name: recipeName(event.recipeId) })}`);
    } else if (event.type === 'brew' && event.bottled) {
      messages.push(`${ICONS.potion} ${t('ev.bottled', { name: recipeName(event.recipeId) })}`);
    } else if (event.type === 'brew') {
      const used = event.used.map((e) => ELEMENTS[e].icon).join('');
      messages.push(
        `${ICONS.cauldron} ${
          event.recipeId === SLUDGE.id ? t('ev.sludge', { used }) : t('ev.brew', { used, name: recipeName(event.recipeId) })
        }`,
      );
    } else if (event.type === 'forecast') {
      const next = state.weather.forecast[0];
      if (next) messages.push(`${ICONS.sky} ${t('ev.forecast', { sky: describeSkyCard(next) })}`);
    } else if (event.type === 'skyAdded') {
      const cards = event.cards.map(describeSkyCard).join(', ');
      messages.push(`${ICONS.sky} ${t('ev.skyAdded', { enemy: enemy(event.index), cards })}`);
    } else if (event.type === 'enemyBrew') {
      messages.push(
        event.recipeId === SLUDGE.id
          ? t('ev.enemySludge', { enemy: enemy(event.index) })
          : `${ICONS.cauldron} ${t('ev.enemyBrew', { enemy: enemy(event.index), name: recipeName(event.recipeId) })}`,
      );
    } else if (event.type === 'pilfer') {
      messages.push(t(event.kept ? 'ev.pilfer' : 'ev.pilferLost', { enemy: enemy(event.index), ...element(event.element) }));
    } else if (event.type === 'spoiled') {
      messages.push(`${ICONS.spoiled} ${t('ev.spoiled', { enemy: enemy(event.index) })}`);
    } else if (event.type === 'element' && event.fromWeather) {
      messages.push(t('ev.caught', { weather: weatherName(state.weather.current), ...element(event.element) }));
    } else if (event.type === 'spill') {
      messages.push(t('ev.spill', element(event.element)));
    } else if (event.type === 'exposure') {
      messages.push(describeExposure(state));
    } else if (event.type === 'damage' && event.source === 'lightning') {
      messages.push(
        `${ICONS.lightning} ${
          event.target.side === 'player' ? t('ev.lightningYou') : t('ev.lightning', { enemy: enemy(event.target.index) })
        }`,
      );
    } else if (event.type === 'steal') {
      messages.push(t('ev.steal', { enemy: enemy(event.index), ...element(event.element) }));
    } else if (event.type === 'enemyHeal' && event.amount > 0) {
      messages.push(`${ICONS.heal} ${t('ev.enemyHeal', { enemy: enemy(event.index), n: event.amount })}`);
    } else if (event.type === 'shatter') {
      messages.push(`${ICONS.shatter} ${t('ev.shatter', { enemy: actingEnemy })}`);
    } else if (event.type === 'relic') {
      messages.push(`${RELIC_ICONS[event.relic] ?? ''} ${relicName(event.relic)}!`);
    }
  }
  return messages.join(' ');
}

interface HasText {
  effects: readonly Effect[];
  text: string;
}

/** A card's effects with its text in the current language. */
function cardItem(def: CardDef): HasText {
  return { effects: def.effects, text: cardText(def) };
}

/** A recipe's effects with its text in the current language. */
function recipeItem(id: string): HasText {
  return { effects: getRecipe(id).effects, text: recipeText(id) };
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
  // Attacking enemies lunge at you, one after another.
  let lunges = 0;
  for (const event of events) {
    if (event.type !== 'enemyMove' || !event.move.damage) continue;
    const body = root.querySelector<HTMLElement>(`[data-unit="enemy-${event.index}"] .enemy-body`);
    if (!body) continue;
    body.style.animationDelay = `${lunges++ * 160}ms`;
    flash(body, 'lunge');
  }
  // New elements pop into the cauldron's last slots.
  const added = events.filter((e) => e.type === 'element').length;
  const filled = [...root.querySelectorAll<HTMLElement>('.cauldron .slot.filled')];
  for (const slot of filled.slice(Math.max(0, filled.length - added))) flash(slot, 'pop');

  for (const event of events) {
    if (event.type === 'weather') {
      flash(root.querySelector('.forecast'), 'weather-changed');
      continue;
    }
    if (event.type === 'brew') {
      const cauldron = root.querySelector<HTMLElement>('.cauldron');
      flash(cauldron, 'brewed');
      if (cauldron) floatText(cauldron, recipeName(event.recipeId), 'brew');
      continue;
    }
    if (event.type === 'heal') {
      const player = root.querySelector<HTMLElement>('[data-unit="player"]');
      if (player && event.amount > 0) floatText(player, `+${event.amount}`, 'heal');
      continue;
    }
    if (event.type === 'enemyBrew') {
      const unit = root.querySelector<HTMLElement>(`[data-unit="enemy-${event.index}"]`);
      flash(unit, 'brewed');
      if (unit) floatText(unit, recipeName(event.recipeId), 'brew');
      continue;
    }
    if (event.type === 'steal') {
      const cauldron = root.querySelector<HTMLElement>('.cauldron');
      flash(cauldron, 'hit');
      if (cauldron) floatText(cauldron, `-${ELEMENTS[event.element].icon}`, 'damage');
      continue;
    }
    if (event.type === 'enemyHeal') {
      const unit = root.querySelector<HTMLElement>(`[data-unit="enemy-${event.index}"]`);
      if (unit && event.amount > 0) floatText(unit, `+${event.amount}`, 'heal');
      continue;
    }
    if (event.type === 'shatter') {
      const player = root.querySelector<HTMLElement>('[data-unit="player"]');
      shake(player);
      if (player) floatText(player, `${ICONS.shatter} -${event.amount} ${ICONS.block}`, 'damage');
      continue;
    }
    if (event.type !== 'damage' && event.type !== 'block') continue;
    const unit = root.querySelector<HTMLElement>(unitSelector(event.target));
    if (!unit) continue;
    const float = document.createElement('span');
    if (event.type === 'damage') {
      float.className = `float damage ${event.source ?? ''}`;
      const icon = event.source === 'burn' ? ` ${ICONS.burn}` : event.source === 'lightning' ? ` ${ICONS.lightning}` : '';
      float.textContent = event.amount > 0 ? `-${event.amount}${icon}` : t('combat.blocked');
      if (event.amount > 0) flash(unit);
      if (event.source === 'lightning') {
        flash(root.querySelector('.combat'), 'lightning-flash');
        flashSky();
      }
    } else {
      float.className = 'float block';
      float.textContent = `+${event.amount} ${ICONS.block}`;
    }
    unit.appendChild(float);
    float.addEventListener('animationend', () => float.remove());
  }
}

/** A copy of a card in hand and where it is, so it can fly off after being played. */
function captureCard(root: HTMLElement, uid: number): { el: HTMLElement; rect: DOMRect } | null {
  const card = root.querySelector<HTMLElement>(`[data-uid="${uid}"]`);
  if (!card || !motionAllowed()) return null;
  return { el: card.cloneNode(true) as HTMLElement, rect: card.getBoundingClientRect() };
}

/** Flies a played card's copy to its target (an enemy, the cauldron or you) and fades it. */
function flyGhost(ghost: { el: HTMLElement; rect: DOMRect }, target: Element | null): void {
  const { el, rect } = ghost;
  el.removeAttribute('data-uid');
  el.classList.remove('selected', 'drawn');
  el.classList.add('card-ghost');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  el.style.setProperty('--card-width', `${rect.width}px`);
  document.body.appendChild(el);
  const to = target?.getBoundingClientRect();
  const dx = to ? to.left + to.width / 2 - (rect.left + rect.width / 2) : 0;
  const dy = to ? to.top + to.height / 2 - (rect.top + rect.height / 2) : -120;
  const flight = el.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(0.75)`, opacity: 0.9, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 },
    ],
    { duration: 380, easing: 'ease-in' },
  );
  flight.onfinish = () => el.remove();
  flight.oncancel = () => el.remove();
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
