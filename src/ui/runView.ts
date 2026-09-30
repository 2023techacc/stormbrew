import { MAP_LANES, type MapNode } from '../core/map';
import {
  INFUSE_ELEMENTS,
  addCardToDeck,
  availableNodes,
  buyCard,
  buyPotion,
  buyRelic,
  buySky,
  canInfuse,
  chartSky,
  MIN_SKY,
  createRun,
  currentNode,
  enterNode,
  finishFight,
  infuseCard,
  removeCard,
  rest,
  restHealAmount,
  runFloor,
  startFight,
  startNextAct,
  takeBossRelic,
  type FightRewards,
  type RunScreen,
  type RunState,
} from '../core/run';
import {
  canPickEventCard,
  cancelEventPick,
  chooseEventOption,
  currentEvent,
  eventCardOptions,
  eventOptionBlocked,
  eventSkyOptions,
  pendingPick,
  pickEventCard,
  pickEventReward,
  pickEventSky,
  type EventResult,
} from '../core/events';
import type { Grimoire } from '../core/grimoire';
import { makeRunSave, type RunSave } from '../core/save';
import type { CombatState, ElementId } from '../core/types';
import { getCard } from '../data/cards';
import { distilledRecipe } from '../data/distilled';
import { getRecipe } from '../data/recipes';
import { getSkyCard } from '../data/sky';
import { t } from '../i18n';
import {
  actName,
  cardName,
  elementName,
  eventName,
  eventText,
  optionLabel,
  optionText,
  recipeName,
  recipeText,
  relicName,
  relicText,
  skyName,
  skyText,
} from '../i18n/content';
import { cardFace, showCombat } from './combatView';
import { esc, fitCards } from './dom';
import { playSfx, type Sfx } from './sound';
import { clearRun, saveGrimoire, saveRun } from './storage';
import { baseText } from './text';
import { ELEMENTS, EVENT_ICONS, ICONS, NODE_ICONS, RELIC_ICONS, WEATHERS, nodeIcon } from './theme';
import { setWeatherFx } from './weatherFx';

export interface RunViewOptions {
  onExit: () => void;
  /** Recipes known so far; updated (and saved) as new ones are brewed. */
  grimoire: Grimoire;
  /** A saved run to continue instead of starting a new one. */
  resume?: RunSave | null;
}

/**
 * A run through Act 1: map, fights, rewards, rest sites and shops, up to the
 * boss. The run is saved after every action, so it can be continued later.
 */
export function showRun(root: HTMLElement, options: RunViewOptions): void {
  const { onExit, grimoire } = options;
  let run: RunState = options.resume?.run ?? createRun(randomSeed());
  let screen: RunScreen = options.resume?.screen ?? { name: 'map' };
  let showDeck = false;
  let showSky = false;
  let message = '';
  /**
   * What the next render does with the scroll position: arriving at the map
   * scrolls to the reachable spots, other new screens start at the top, and
   * redrawing the same screen keeps the position.
   */
  let scroll: 'map' | 'top' | 'keep' = 'map';

  /** Saves the run (and the fight in progress, if any). A finished run is deleted. */
  const persist = (combat?: CombatState) => {
    if (run.status !== 'playing') clearRun();
    else saveRun(makeRunSave(run, screen, combat));
    saveGrimoire(grimoire);
  };

  const go = (next: RunScreen, note = '') => {
    if (next.name !== screen.name) scroll = next.name === 'map' ? 'map' : 'top';
    screen = next;
    message = note;
    persist();
    render();
  };

  const render = () => {
    root.onclick = onClick;
    if (screen.name === 'combat') return;
    setWeatherFx(null);
    // A new screen fades in; redrawing the same one doesn't.
    const entering = scroll !== 'keep';
    if (screen.name === 'over') {
      root.innerHTML = renderOver(run);
      return;
    }
    const body =
      screen.name === 'map'
        ? renderMap(run)
        : screen.name === 'reward'
          ? renderReward(screen.rewards)
          : screen.name === 'bossRelic'
            ? renderBossRelic(screen.rewards)
            : screen.name === 'rest'
            ? renderRest(run, screen.step, screen.deckIndex)
            : screen.name === 'event'
              ? renderEvent(run, screen.step, grimoire)
              : renderShop(run, screen.name === 'shop' && screen.removing);
    const scrollY = window.scrollY;
    // Picking a card from the deck: the deck scrolls inside the screen, which is exactly the phone's height.
    const picking =
      (screen.name === 'rest' && screen.step === 'pickCard') ||
      (screen.name === 'event' && screen.step === 'pickCard') ||
      (screen.name === 'shop' && screen.removing);
    root.innerHTML = `
      <main class="screen run-screen ${entering ? 'enter' : ''} ${picking ? 'fills' : ''}">
        ${renderHeader(run)}
        <p class="run-message" aria-live="polite">${esc(message)}</p>
        ${body}
        ${showDeck ? renderDeck(run) : ''}
        ${showSky ? renderSky(run) : ''}
      </main>
    `;
    fitCards(root);
    if (scroll === 'map') root.querySelector('.map-node.reachable')?.scrollIntoView({ block: 'center' });
    else window.scrollTo(0, scroll === 'top' ? 0 : scrollY);
    scroll = 'keep';
  };

  const showFight = (state: CombatState, label: string) => {
    screen = { name: 'combat', label };
    persist(state);
    showCombat(root, { state, label, grimoire, onFinished: afterFight, onExit, onChange: persist });
  };

  const startNodeFight = (node: MapNode) => {
    const { state } = startFight(run);
    const elite = node.type === 'elite' || node.type === 'event';
    const floor = runFloor(run, node);
    showFight(state, node.type === 'boss' ? t('fight.boss') : t(elite ? 'fight.eliteFloor' : 'fight.floor', { floor }));
  };

  /** Plays an action's sound, or the "can't do that" sound when it wasn't allowed. */
  const sound = (result: { ok: boolean }, sfx: Sfx) => playSfx(result.ok ? sfx : 'deny');

  /** Follows an event choice: back to the map, on to a pick, or into a fight. */
  const afterEvent = (result: EventResult) => {
    sound(result, 'tap');
    if (!result.ok) return go(screen, result.reason);
    if (result.next === 'map') return go({ name: 'map' }, result.message);
    if (result.next === 'pickCard' || result.next === 'pickSky' || result.next === 'pickReward') {
      return go({ name: 'event', step: result.next }, result.message);
    }
    const node = currentNode(run);
    if (!node) return go({ name: 'map' });
    root.onclick = null;
    startNodeFight(node);
  };

  const afterFight = (combat: CombatState) => {
    const rewards = finishFight(run, combat);
    if (run.status !== 'playing') go({ name: 'over' });
    else if (rewards.bossRelics?.length) go({ name: 'bossRelic', rewards });
    else go({ name: 'reward', rewards });
  };

  /** Leaves a fight's rewards: back to the map, or after an act's boss, on to the next act. */
  const leaveRewards = (note: string) => {
    if (currentNode(run)?.type !== 'boss') return go({ name: 'map' }, note);
    const healed = startNextAct(run);
    scroll = 'map';
    const next = t('run.nextAct', { n: run.act, name: actName(run.act) });
    go({ name: 'map' }, healed > 0 ? `${next} ${t('run.nextActHealed', { n: healed })}` : next);
  };

  const onClick = (event: MouseEvent) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-action],[data-node],[data-relic],[data-potion-info],[data-reward],[data-boss-relic],[data-deck-index],[data-element],[data-buy-card],[data-buy-relic],[data-buy-potion],[data-buy-sky],[data-sky-index],[data-event-option],[data-event-card]',
    );
    if (!el) return;
    const d = el.dataset;

    if (d.action === 'deck' || d.action === 'sky' || d.action === 'close' || d.relic || d.potionInfo) playSfx('tap');
    if (d.action === 'deck') return ((showDeck = true), render());
    if (d.action === 'sky') return ((showSky = true), render());
    if (d.action === 'close') return ((showDeck = false), (showSky = false), render());
    if (d.relic) {
      return go(screen, `${RELIC_ICONS[d.relic] ?? ''} ${relicName(d.relic)}: ${relicText(d.relic)}`);
    }
    if (d.potionInfo) {
      const text = potionText(d.potionInfo);
      return go(screen, `${ICONS.potion} ${t('run.potionInfo', { name: recipeName(d.potionInfo), text })}`);
    }
    if (d.action === 'none' || showDeck || showSky) return;

    if (screen.name === 'map' && d.node) {
      playSfx('tap');
      const node = enterNode(run, d.node);
      if (node.type === 'rest') return go({ name: 'rest', step: 'choose' });
      if (node.type === 'shop') return go({ name: 'shop', removing: false });
      if (node.type === 'event') return go({ name: 'event', step: 'choose' });
      root.onclick = null;
      return startNodeFight(node);
    }

    if (screen.name === 'bossRelic') {
      const { rewards } = screen;
      if (d.bossRelic) {
        takeBossRelic(run, rewards, d.bossRelic);
        playSfx('coin');
      } else if (d.action === 'skip') {
        delete rewards.bossRelics;
        playSfx('tap');
      } else return;
      return go({ name: 'reward', rewards });
    }

    if (screen.name === 'reward') {
      if (d.reward) addCardToDeck(run, d.reward);
      if (d.reward || d.action === 'skip') playSfx(d.reward ? 'card' : 'tap');
      if (d.reward || d.action === 'skip') leaveRewards(d.reward ? t('run.added', { name: cardName(getCard(d.reward)) }) : '');
      return;
    }

    if (screen.name === 'rest') {
      if (d.action === 'rest') {
        playSfx('heal');
        return go({ name: 'map' }, t('run.rested', { n: rest(run) }));
      }
      if (d.action) playSfx('tap');
      if (d.action === 'infuse') return go({ name: 'rest', step: 'pickCard' }, t('run.pickInfuse'));
      if (d.action === 'chart') return go({ name: 'rest', step: 'pickSky' }, t('run.pickChart'));
      if (d.skyIndex !== undefined && screen.step === 'pickSky') {
        const name = skyName(run.sky[Number(d.skyIndex)] ?? 'clear');
        const result = chartSky(run, Number(d.skyIndex));
        sound(result, 'weather');
        return result.ok ? go({ name: 'map' }, t('run.skyGone', { name })) : go(screen, result.reason);
      }
      if (d.action === 'back') return go({ name: 'rest', step: 'choose' });
      if (d.deckIndex !== undefined && screen.step === 'pickCard') {
        const index = Number(d.deckIndex);
        const card = run.deck[index];
        const ok = !!card && canInfuse(card);
        sound({ ok }, 'tap');
        if (!ok) return go(screen, t('err.alreadyInfused'));
        return go({ name: 'rest', step: 'pickElement', deckIndex: index }, t('run.pickElement'));
      }
      if (d.element && screen.step === 'pickElement' && screen.deckIndex !== undefined) {
        const card = run.deck[screen.deckIndex];
        infuseCard(run, screen.deckIndex, d.element as ElementId);
        playSfx('element');
        const name = card ? cardName(getCard(card.id)) : t('run.theCard');
        return go({ name: 'map' }, t('run.infused', { name, icon: ELEMENTS[d.element as ElementId].icon }));
      }
      return;
    }

    if (screen.name === 'event') {
      if (d.eventOption) return afterEvent(chooseEventOption(run, d.eventOption, grimoire));
      if (d.action === 'back' || d.action === 'leave') playSfx('tap');
      if (d.action === 'back') {
        cancelEventPick(run);
        return go({ name: 'event', step: 'choose' });
      }
      if (d.deckIndex !== undefined && screen.step === 'pickCard') {
        return afterEvent(pickEventCard(run, Number(d.deckIndex), grimoire));
      }
      if (d.skyIndex !== undefined && screen.step === 'pickSky') {
        return afterEvent(pickEventSky(run, Number(d.skyIndex), grimoire));
      }
      if (d.eventCard !== undefined && screen.step === 'pickReward') {
        const result = pickEventReward(run, Number(d.eventCard), grimoire);
        if (result.ok) playSfx('card');
        return result.ok ? go({ name: 'map' }, result.message) : afterEvent(result);
      }
      if (d.action === 'leave') return go({ name: 'map' });
      return;
    }

    if (screen.name === 'shop') {
      if (d.action) playSfx('tap');
      if (d.action === 'leave') return go({ name: 'map' });
      if (d.action === 'remove') return go({ name: 'shop', removing: true }, t('run.pickRemove'));
      if (d.action === 'back') return go({ name: 'shop', removing: false });
      if (d.buyCard !== undefined) {
        const result = buyCard(run, Number(d.buyCard));
        sound(result, 'coin');
        return go(screen, result.ok ? t('run.bought') : result.reason);
      }
      if (d.buyRelic !== undefined) {
        const result = buyRelic(run, Number(d.buyRelic));
        sound(result, 'coin');
        return go(screen, result.ok ? t('run.bought') : result.reason);
      }
      if (d.buyPotion !== undefined) {
        const result = buyPotion(run, Number(d.buyPotion));
        sound(result, 'coin');
        return go(screen, result.ok ? t('run.bought') : result.reason);
      }
      if (d.buySky !== undefined) {
        const result = buySky(run, Number(d.buySky));
        sound(result, 'coin');
        return go(screen, result.ok ? t('run.addedToSky') : result.reason);
      }
      if (d.deckIndex !== undefined && screen.removing) {
        const card = run.deck[Number(d.deckIndex)];
        const result = removeCard(run, Number(d.deckIndex));
        sound(result, 'coin');
        const message = result.ok ? (card ? t('run.removed', { name: cardName(getCard(card.id)) }) : '') : result.reason;
        return go({ name: 'shop', removing: false }, message);
      }
      return;
    }

    if (screen.name === 'over') {
      if (d.action) playSfx('tap');
      if (d.action === 'new-run') {
        run = createRun(randomSeed());
        showDeck = false;
        showSky = false;
        go({ name: 'map' });
      } else if (d.action === 'title') {
        root.onclick = null;
        onExit();
      }
    }
  };

  const resumed = options.resume;
  if (resumed?.screen.name === 'combat' && resumed.combat) showFight(resumed.combat, resumed.screen.label);
  else {
    persist();
    render();
  }
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/** A potion's effect as text, with base damage (outside fights there's no weather). */
function potionText(recipeId: string): string {
  return baseText({ effects: getRecipe(recipeId).effects, text: recipeText(recipeId) });
}

/** "💰 60" */
const goldAmount = (amount: number) => `${ICONS.gold} ${amount}`;

function renderHeader(run: RunState): string {
  return `
    <header class="run-header">
      <span class="stat" title="${esc(t('run.hp'))}">${ICONS.hp} ${run.hp}/${run.maxHp}</span>
      <span class="stat" title="${esc(t('run.gold'))}">${ICONS.gold} ${run.gold}</span>
      <span class="header-buttons">
        <button class="tool-button" data-action="sky" title="${esc(t('run.sky'))}">${ICONS.sky} ${run.sky.length}</button>
        <button class="tool-button" data-action="deck" title="${esc(t('run.deck'))}">${ICONS.deck} ${run.deck.length}</button>
      </span>
    </header>
    <section class="relic-bar" aria-label="${esc(t('run.relicBar'))}">
      ${run.relics
        .map((id) => `<button class="relic" data-relic="${esc(id)}" title="${esc(relicName(id))}">${RELIC_ICONS[id] ?? '❔'}</button>`)
        .join('')}
      ${run.potions
        .map(
          (id) => `<button class="relic potion-icon" data-potion-info="${esc(id)}" title="${esc(recipeName(id))}">${ICONS.potion}</button>`,
        )
        .join('')}
    </section>
  `;
}

function renderMap(run: RunState): string {
  const nodes = Object.values(run.map.nodes);
  const reachable = new Set(availableNodes(run).map((n) => n.id));
  const visited = new Set(run.visited);
  // Positions are percentages, so the map can stretch to whatever height the phone has.
  const rows = run.map.floors + 1;
  const x = (node: MapNode) => ((node.lane + 0.5) / MAP_LANES) * 100;
  const y = (node: MapNode) => ((rows - 0.5 - node.floor) / rows) * 100;

  const lines = nodes.flatMap((node) =>
    node.next.flatMap((id) => {
      const to = run.map.nodes[id];
      if (!to) return [];
      const taken = visited.has(node.id) && visited.has(to.id);
      return [`<line x1="${x(node)}" y1="${y(node)}" x2="${x(to)}" y2="${y(to)}" class="${taken ? 'taken' : ''}" />`];
    }),
  );
  const buttons = nodes.map((node) => {
    const state = [
      reachable.has(node.id) ? 'reachable' : '',
      visited.has(node.id) ? 'visited' : '',
      node.id === run.nodeId ? 'current' : '',
    ].join(' ');
    return `<button class="map-node ${node.type} ${state}" data-node="${node.id}"
      style="left: ${x(node)}%; top: ${y(node)}%" ${reachable.has(node.id) ? '' : 'disabled'}
      aria-label="${esc(t('map.nodeAria', { type: t(`node.${node.type}`), floor: runFloor(run, node) }))}">${nodeIcon(node.type, run.act)}</button>`;
  });

  return `
    <p class="map-title muted small"><strong>${esc(t('map.act', { n: run.act }))} · ${esc(actName(run.act))}</strong>${
      // How to move, until the first move of the run.
      run.act === 1 && run.nodeId === null ? ` · ${esc(t('map.hint'))}` : ''
    }</p>
    <section class="map" style="--rows: ${rows}">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>
      ${buttons.join('')}
    </section>
    <p class="map-legend muted small">
      ${(['fight', 'elite', 'event', 'rest', 'shop', 'boss'] as const).map((type) => `${nodeIcon(type, run.act)} ${esc(t(`node.${type}`))}`).join(' · ')}
    </p>
  `;
}

function renderReward(rewards: FightRewards): string {
  const relic = rewards.relic;
  return `
    <h2>${esc(t('reward.title'))}</h2>
    <p>+${rewards.gold} ${ICONS.gold}${rewards.healed > 0 ? ` · ${esc(t('reward.herb', { n: rewards.healed }))}` : ''}</p>
    ${
      relic
        ? `<p class="relic-found">${RELIC_ICONS[relic] ?? ''} <strong>${esc(relicName(relic))}</strong>: ${esc(relicText(relic))}</p>`
        : ''
    }
    ${rewards.potion ? `<p class="relic-found">${ICONS.potion} ${esc(t('reward.potion', { name: recipeName(rewards.potion) }))}</p>` : ''}
    <p>${esc(t('reward.choose'))}</p>
    ${
      rewards.cardChoices.some((id) => distilledRecipe(id))
        ? `<p class="muted small">${ICONS.cauldron} ${esc(t('reward.distilledNote'))}</p>`
        : ''
    }
    <section class="reward-cards">
      ${rewards.cardChoices
        .map((id) => {
          const from = distilledRecipe(id);
          const def = getCard(id);
          return cardFace(def, 'clear', {
            attrs: `data-reward="${esc(id)}"`,
            className: from ? 'distilled' : '',
            note: from
              ? `${ICONS.cauldron} ${t('reward.distilled')}`
              : def.rarity === 'rare'
                ? `${ICONS.rare} ${t('reward.rare')}`
                : undefined,
          });
        })
        .join('')}
    </section>
    <button class="text-button" data-action="skip">${esc(t('common.skip'))}</button>
  `;
}

/** After an act's boss: choose one of three boss relics (or none). */
function renderBossRelic(rewards: FightRewards): string {
  return `
    <h2>${ICONS.crown} ${esc(t('bossRelic.title'))}</h2>
    <p class="muted small">${esc(t('bossRelic.choose'))}</p>
    <section class="shop-relics">
      ${(rewards.bossRelics ?? [])
        .map(
          (id) => `<button class="shop-relic boss-relic" data-boss-relic="${esc(id)}">
            <span class="relic-icon">${RELIC_ICONS[id] ?? '❔'}</span>
            <span class="recipe-body"><strong>${esc(relicName(id))}</strong> ${esc(relicText(id))}</span>
          </button>`,
        )
        .join('')}
    </section>
    <button class="text-button" data-action="skip">${esc(t('common.skip'))}</button>
  `;
}

function renderRest(run: RunState, step: 'choose' | 'pickCard' | 'pickElement' | 'pickSky', deckIndex?: number): string {
  if (step === 'pickSky') {
    return `
      <h2>${ICONS.sky} ${esc(t('rest.chart'))}</h2>
      <p class="muted small">${esc(t('rest.chartText'))}</p>
      ${skyList(run.sky, (i) => `data-sky-index="${i}"`)}
      ${backButton()}
    `;
  }
  if (step === 'pickCard') {
    return `
      <h2>${NODE_ICONS.rest} ${esc(t('rest.infuseTitle'))}</h2>
      <p class="muted small">${esc(t('rest.infuseText'))}</p>
      ${deckGrid(run, (i) => {
        const card = run.deck[i];
        return card && canInfuse(card) ? '' : 'unplayable';
      })}
      ${backButton()}
    `;
  }
  if (step === 'pickElement' && deckIndex !== undefined) {
    const card = run.deck[deckIndex];
    return `
      <h2>${NODE_ICONS.rest} ${esc(t('rest.infuseTitle'))}</h2>
      ${card ? `<section class="reward-cards">${cardFace(getCard(card.id), 'clear', { attrs: 'data-action="none"' })}</section>` : ''}
      <section class="element-choices">
        ${INFUSE_ELEMENTS.map(
          (e) => `<button class="element-choice" data-element="${e}" style="--chip-color: ${ELEMENTS[e].color}">
            ${ELEMENTS[e].icon}<small>${esc(elementName(e))}</small></button>`,
        ).join('')}
      </section>
      ${backButton()}
    `;
  }
  const heal = restHealAmount(run);
  return `
    <h2>${NODE_ICONS.rest} ${esc(t('rest.title'))}</h2>
    <p class="muted">${esc(t('rest.choose'))}</p>
    <span class="title-buttons">
      <button class="primary-button" data-action="rest" ${heal > 0 ? '' : 'disabled'}>${esc(t('rest.heal', { n: heal }))}</button>
      <button class="secondary-button" data-action="infuse">${esc(t('rest.infuse'))}</button>
      <button class="secondary-button" data-action="chart" ${run.sky.length > MIN_SKY ? '' : 'disabled'}>
        ${ICONS.sky} ${esc(t('rest.chart'))}
      </button>
    </span>
  `;
}

function renderEvent(run: RunState, step: 'choose' | 'pickCard' | 'pickSky' | 'pickReward', grimoire: Grimoire): string {
  const event = currentEvent(run);
  if (!event) {
    return `<p>${esc(t('event.nothingLeft'))}</p><button class="primary-button" data-action="leave">${esc(t('common.continue'))}</button>`;
  }
  const title = `<h2>${EVENT_ICONS[event.id] ?? NODE_ICONS.event} ${esc(eventName(event.id))}</h2>`;
  const pick = pendingPick(run);
  if (step === 'pickCard' && pick) {
    return `
      ${title}
      ${deckGrid(run, (i) => (canPickEventCard(run, i) ? '' : 'unplayable'))}
      ${backButton()}
    `;
  }
  if (step === 'pickSky' && pick) {
    return `
      ${title}
      ${skyList(eventSkyOptions(run), (i) => `data-sky-index="${i}"`)}
      ${backButton()}
    `;
  }
  if (step === 'pickReward' && pick) {
    return `
      ${title}
      <section class="reward-cards">
        ${eventCardOptions(run)
          .map((id, i) => cardFace(getCard(id), 'clear', { attrs: `data-event-card="${i}"`, note: `${ICONS.rare} ${t('reward.rare')}` }))
          .join('')}
      </section>
      ${backButton()}
    `;
  }
  return `
    ${title}
    <p class="event-text">${esc(eventText(event.id))}</p>
    <section class="event-options">
      ${event.options
        .map((option) => {
          const blocked = eventOptionBlocked(run, option, grimoire);
          return `<button class="event-option" data-event-option="${esc(option.id)}" ${blocked ? 'disabled' : ''}>
            <strong>${esc(optionLabel(event.id, option.id))}</strong>
            <span>${esc(blocked ?? optionText(event.id, option.id))}</span>
          </button>`;
        })
        .join('')}
    </section>
  `;
}

function renderShop(run: RunState, removing: boolean): string {
  const shop = run.shop;
  if (!shop) {
    return `<p>${esc(t('shop.closed'))}</p><button class="primary-button" data-action="leave">${esc(t('common.leave'))}</button>`;
  }
  if (removing) {
    return `
      <h2>${NODE_ICONS.shop} ${esc(t('shop.removeTitle'))}</h2>
      <p class="muted small">${esc(t('shop.removeCost', { price: goldAmount(shop.removalPrice) }))}</p>
      ${deckGrid(run, () => '')}
      ${backButton()}
    `;
  }
  const price = (p: number, sold: boolean) =>
    `<span class="price ${sold ? 'sold' : run.gold < p ? 'too-expensive' : ''}">${sold ? esc(t('shop.sold')) : goldAmount(p)}</span>`;
  return `
    <h2>${NODE_ICONS.shop} ${esc(t('shop.title'))}</h2>
    <section class="shop-cards">
      ${shop.cards
        .map(
          (item, i) => `<span class="shop-item">
            ${cardFace(getCard(item.id), 'clear', { attrs: `data-buy-card="${i}"`, className: item.sold ? 'unplayable' : '' })}
            ${price(item.price, item.sold)}
          </span>`,
        )
        .join('')}
    </section>
    <section class="shop-relics">
      ${shop.relics
        .map((item, i) => {
          return `<button class="shop-relic ${item.sold ? 'sold' : ''}" data-buy-relic="${i}">
            <span class="relic-icon">${RELIC_ICONS[item.id] ?? '❔'}</span>
            <span class="recipe-body"><strong>${esc(relicName(item.id))}</strong> ${esc(relicText(item.id))}</span>
            ${price(item.price, item.sold)}
          </button>`;
        })
        .join('')}
    </section>
    <section class="shop-relics">
      ${shop.potions
        .map((item, i) => {
          return `<button class="shop-relic ${item.sold ? 'sold' : ''}" data-buy-potion="${i}">
            <span class="relic-icon">${ICONS.potion}</span>
            <span class="recipe-body"><strong>${esc(t('shop.potion', { name: recipeName(item.id) }))}</strong> ${esc(potionText(item.id))}</span>
            ${price(item.price, item.sold)}
          </button>`;
        })
        .join('')}
    </section>
    <section class="shop-relics">
      ${shop.sky
        .map((item, i) => {
          const card = getSkyCard(item.id);
          return `<button class="shop-relic ${item.sold ? 'sold' : ''}" data-buy-sky="${i}">
            <span class="relic-icon">${WEATHERS[card.weather].icon}</span>
            <span class="recipe-body"><strong>${esc(skyName(item.id))}</strong> ${esc(t('shop.weatherCard', { text: skyText(item.id) }))}</span>
            ${price(item.price, item.sold)}
          </button>`;
        })
        .join('')}
    </section>
    <span class="button-row">
      <button class="secondary-button" data-action="remove" ${shop.removalUsed ? 'disabled' : ''}>
        ${esc(t('shop.remove', { price: goldAmount(shop.removalPrice) }))}
      </button>
      <button class="primary-button" data-action="leave">${esc(t('common.leave'))}</button>
    </span>
  `;
}

function backButton(): string {
  return `<button class="text-button" data-action="back">${esc(t('common.back'))}</button>`;
}

/** The deck as tappable cards, scrolling in the screen's free height; `extraClass(i)` can mark some unavailable. */
function deckGrid(run: RunState, extraClass: (index: number) => string): string {
  return `
    <section class="card-grid pick-scroll">
      ${run.deck
        .map((card, i) =>
          cardFace(getCard(card.id), 'clear', {
            attrs: `data-deck-index="${i}"`,
            className: extraClass(i),
            infusion: card.infusion,
          }),
        )
        .join('')}
    </section>
  `;
}

function renderDeck(run: RunState): string {
  return `
    <span class="overlay" data-action="close">
      <span class="recipe-panel" role="dialog" aria-label="${esc(t('run.deck'))}" data-action="none">
        <span class="recipe-header">
          <h2>${esc(t('deck.title', { n: run.deck.length }))}</h2>
          <button class="text-button" data-action="close">${esc(t('common.close'))}</button>
        </span>
        <span class="deck-scroll">
          <span class="card-grid">
            ${run.deck
              .map((card) => cardFace(getCard(card.id), 'clear', { attrs: 'data-action="none"', infusion: card.infusion }))
              .join('')}
          </span>
        </span>
      </span>
    </span>
  `;
}

/** Weather cards as rows; `attrs(i)` makes them tappable. */
function skyList(sky: readonly string[], attrs: (index: number) => string): string {
  return `
    <section class="shop-relics">
      ${sky
        .map((id, i) => {
          const card = getSkyCard(id);
          return `<button class="shop-relic" ${attrs(i)}>
            <span class="relic-icon">${WEATHERS[card.weather].icon}</span>
            <span class="recipe-body"><strong>${esc(skyName(id))}</strong> ${esc(skyText(id))}</span>
          </button>`;
        })
        .join('')}
    </section>
  `;
}

function renderSky(run: RunState): string {
  return `
    <span class="overlay" data-action="close">
      <span class="recipe-panel" role="dialog" aria-label="${esc(t('run.sky'))}" data-action="none">
        <span class="recipe-header">
          <h2>${ICONS.sky} ${esc(t('sky.title', { n: run.sky.length }))}</h2>
          <button class="text-button" data-action="close">${esc(t('common.close'))}</button>
        </span>
        <span class="recipe-rules">${esc(t('sky.rules'))}</span>
        <span class="deck-scroll">${skyList(run.sky, () => 'data-action="none"')}</span>
      </span>
    </span>
  `;
}

function renderOver(run: RunState): string {
  const won = run.status === 'won';
  const floor = runFloor(run);
  return `
    <main class="screen enter">
      <h2>${esc(t(won ? 'over.won' : 'over.lost'))}</h2>
      <p>${esc(
        won
          ? t('over.wonText')
          : run.fightsWon === 1
            ? t('over.lostText1', { floor })
            : t('over.lostText', { floor, n: run.fightsWon }),
      )}</p>
      <p class="muted small">
        ${esc(t('over.summary', { n: run.deck.length, relics: run.relics.map((id) => RELIC_ICONS[id] ?? '').join(' ') }))}
      </p>
      <span class="title-buttons">
        <button class="primary-button" data-action="new-run">${esc(t('over.newRun'))}</button>
        <button class="text-button" data-action="title">${esc(t('over.title'))}</button>
      </span>
    </main>
  `;
}
