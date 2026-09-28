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
  startFight,
  type FightRewards,
  type RunScreen,
  type RunState,
} from '../core/run';
import type { Grimoire } from '../core/grimoire';
import { makeRunSave, type RunSave } from '../core/save';
import type { CombatState, ElementId } from '../core/types';
import { getCard } from '../data/cards';
import { distilledRecipe } from '../data/distilled';
import { getRecipe } from '../data/recipes';
import { getRelic } from '../data/relics';
import { getSkyCard } from '../data/sky';
import { cardFace, showCombat } from './combatView';
import { esc } from './dom';
import { clearRun, saveGrimoire, saveRun } from './storage';
import { baseText } from './text';
import { ELEMENTS, ICONS, NODE_ICONS, NODE_NAMES, RELIC_ICONS, WEATHERS } from './theme';

const MAP_ROW = 64;

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
    if (screen.name === 'over') {
      root.innerHTML = renderOver(run);
      return;
    }
    if (screen.name === 'combat') return;
    const body =
      screen.name === 'map'
        ? renderMap(run)
        : screen.name === 'reward'
          ? renderReward(screen.rewards)
          : screen.name === 'rest'
            ? renderRest(run, screen.step, screen.deckIndex)
            : renderShop(run, screen.removing);
    const scrollY = window.scrollY;
    root.innerHTML = `
      <main class="screen run-screen">
        ${renderHeader(run)}
        <p class="run-message" aria-live="polite">${esc(message)}</p>
        ${body}
        ${showDeck ? renderDeck(run) : ''}
        ${showSky ? renderSky(run) : ''}
      </main>
    `;
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
    showFight(state, node.type === 'boss' ? 'Boss' : `${node.type === 'elite' ? 'Elite · ' : ''}Floor ${node.floor + 1}`);
  };

  const afterFight = (combat: CombatState) => {
    const rewards = finishFight(run, combat);
    if (run.status !== 'playing') go({ name: 'over' });
    else go({ name: 'reward', rewards });
  };

  const onClick = (event: MouseEvent) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-action],[data-node],[data-relic],[data-potion-info],[data-reward],[data-deck-index],[data-element],[data-buy-card],[data-buy-relic],[data-buy-potion],[data-buy-sky],[data-sky-index]',
    );
    if (!el) return;
    const d = el.dataset;

    if (d.action === 'deck') return ((showDeck = true), render());
    if (d.action === 'sky') return ((showSky = true), render());
    if (d.action === 'close') return ((showDeck = false), (showSky = false), render());
    if (d.relic) {
      const relic = getRelic(d.relic);
      return go(screen, `${RELIC_ICONS[relic.id] ?? ''} ${relic.name}: ${relic.text}`);
    }
    if (d.potionInfo) {
      const recipe = getRecipe(d.potionInfo);
      return go(screen, `${ICONS.potion} ${recipe.name} potion: ${baseText(recipe)} Drink it during a fight.`);
    }
    if (d.action === 'none' || showDeck || showSky) return;

    if (screen.name === 'map' && d.node) {
      const node = enterNode(run, d.node);
      if (node.type === 'rest') return go({ name: 'rest', step: 'choose' });
      if (node.type === 'shop') return go({ name: 'shop', removing: false });
      root.onclick = null;
      return startNodeFight(node);
    }

    if (screen.name === 'reward') {
      if (d.reward) addCardToDeck(run, d.reward);
      if (d.reward || d.action === 'skip') go({ name: 'map' }, d.reward ? `Added ${getCard(d.reward).name}.` : '');
      return;
    }

    if (screen.name === 'rest') {
      if (d.action === 'rest') return go({ name: 'map' }, `You rested and healed ${rest(run)} HP.`);
      if (d.action === 'infuse') return go({ name: 'rest', step: 'pickCard' }, 'Pick a card to infuse.');
      if (d.action === 'chart') return go({ name: 'rest', step: 'pickSky' }, 'Pick a weather to clear from your sky.');
      if (d.skyIndex !== undefined && screen.step === 'pickSky') {
        const name = getSkyCard(run.sky[Number(d.skyIndex)] ?? 'clear').name;
        const result = chartSky(run, Number(d.skyIndex));
        return result.ok ? go({ name: 'map' }, `${name} is gone from your sky.`) : go(screen, result.reason);
      }
      if (d.action === 'back') return go({ name: 'rest', step: 'choose' });
      if (d.deckIndex !== undefined && screen.step === 'pickCard') {
        const index = Number(d.deckIndex);
        const card = run.deck[index];
        if (!card || !canInfuse(card)) return go(screen, 'That card is already infused.');
        return go({ name: 'rest', step: 'pickElement', deckIndex: index }, 'Pick an element.');
      }
      if (d.element && screen.step === 'pickElement' && screen.deckIndex !== undefined) {
        const card = run.deck[screen.deckIndex];
        infuseCard(run, screen.deckIndex, d.element as ElementId);
        return go({ name: 'map' }, `${card ? getCard(card.id).name : 'The card'} now also adds ${ELEMENTS[d.element as ElementId].icon}.`);
      }
      return;
    }

    if (screen.name === 'shop') {
      if (d.action === 'leave') return go({ name: 'map' });
      if (d.action === 'remove') return go({ name: 'shop', removing: true }, 'Pick a card to remove.');
      if (d.action === 'back') return go({ name: 'shop', removing: false });
      if (d.buyCard !== undefined) {
        const result = buyCard(run, Number(d.buyCard));
        return go(screen, result.ok ? 'Bought!' : result.reason);
      }
      if (d.buyRelic !== undefined) {
        const result = buyRelic(run, Number(d.buyRelic));
        return go(screen, result.ok ? 'Bought!' : result.reason);
      }
      if (d.buyPotion !== undefined) {
        const result = buyPotion(run, Number(d.buyPotion));
        return go(screen, result.ok ? 'Bought!' : result.reason);
      }
      if (d.buySky !== undefined) {
        const result = buySky(run, Number(d.buySky));
        return go(screen, result.ok ? 'Added to your sky!' : result.reason);
      }
      if (d.deckIndex !== undefined && screen.removing) {
        const card = run.deck[Number(d.deckIndex)];
        const result = removeCard(run, Number(d.deckIndex));
        return go({ name: 'shop', removing: false }, result.ok && card ? `Removed ${getCard(card.id).name}.` : result.ok ? '' : result.reason);
      }
      return;
    }

    if (screen.name === 'over') {
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

function renderHeader(run: RunState): string {
  return `
    <header class="run-header">
      <span class="stat" title="HP">${ICONS.hp} ${run.hp}/${run.maxHp}</span>
      <span class="stat" title="Gold">${ICONS.gold} ${run.gold}</span>
      <span class="header-buttons">
        <button class="tool-button" data-action="sky" title="Your sky">${ICONS.sky} ${run.sky.length}</button>
        <button class="tool-button" data-action="deck" title="Your deck">${ICONS.deck} ${run.deck.length}</button>
      </span>
    </header>
    <section class="relic-bar" aria-label="Relics and potions">
      ${run.relics
        .map((id) => `<button class="relic" data-relic="${esc(id)}" title="${esc(getRelic(id).name)}">${RELIC_ICONS[id] ?? '❔'}</button>`)
        .join('')}
      ${run.potions
        .map(
          (id) => `<button class="relic potion-icon" data-potion-info="${esc(id)}" title="${esc(getRecipe(id).name)}">${ICONS.potion}</button>`,
        )
        .join('')}
    </section>
  `;
}

function renderMap(run: RunState): string {
  const nodes = Object.values(run.map.nodes);
  const reachable = new Set(availableNodes(run).map((n) => n.id));
  const visited = new Set(run.visited);
  const height = (run.map.floors + 1) * MAP_ROW;
  const x = (node: MapNode) => ((node.lane + 0.5) / MAP_LANES) * 100;
  const y = (node: MapNode) => height - MAP_ROW / 2 - node.floor * MAP_ROW;

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
      style="left: ${x(node)}%; top: ${y(node)}px" ${reachable.has(node.id) ? '' : 'disabled'}
      aria-label="${NODE_NAMES[node.type]}, floor ${node.floor + 1}">${NODE_ICONS[node.type]}</button>`;
  });

  return `
    <h2>Act 1</h2>
    <p class="muted small">Tap a glowing spot to go there.</p>
    <section class="map" style="height: ${height}px">
      <svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>
      ${buttons.join('')}
    </section>
    <p class="map-legend muted small">
      ${(['fight', 'elite', 'rest', 'shop', 'boss'] as const).map((t) => `${NODE_ICONS[t]} ${NODE_NAMES[t]}`).join(' · ')}
    </p>
  `;
}

function renderReward(rewards: FightRewards): string {
  const relic = rewards.relic ? getRelic(rewards.relic) : undefined;
  return `
    <h2>Victory!</h2>
    <p>+${rewards.gold} ${ICONS.gold}${rewards.healed > 0 ? ` · +${rewards.healed} HP (Healing Herb)` : ''}</p>
    ${
      relic
        ? `<p class="relic-found">${RELIC_ICONS[relic.id] ?? ''} <strong>${esc(relic.name)}</strong>: ${esc(relic.text)}</p>`
        : ''
    }
    ${rewards.potion ? `<p class="relic-found">${ICONS.potion} Found a <strong>${esc(getRecipe(rewards.potion).name)}</strong> potion!</p>` : ''}
    <p>Choose a card to add to your deck:</p>
    ${
      rewards.cardChoices.some((id) => distilledRecipe(id))
        ? `<p class="muted small">${ICONS.cauldron} Distilled cards come from recipes brewed in this fight.</p>`
        : ''
    }
    <section class="reward-cards">
      ${rewards.cardChoices
        .map((id) => {
          const from = distilledRecipe(id);
          return cardFace(getCard(id), 'clear', {
            attrs: `data-reward="${esc(id)}"`,
            className: from ? 'distilled' : '',
            note: from ? `${ICONS.cauldron} Distilled` : undefined,
          });
        })
        .join('')}
    </section>
    <button class="text-button" data-action="skip">Skip</button>
  `;
}

function renderRest(run: RunState, step: 'choose' | 'pickCard' | 'pickElement' | 'pickSky', deckIndex?: number): string {
  if (step === 'pickSky') {
    return `
      <h2>${ICONS.sky} Chart the sky</h2>
      <p class="muted small">Remove one weather card from your sky, so the others come more often.</p>
      ${skyList(run, (i) => `data-sky-index="${i}"`)}
      <button class="text-button" data-action="back">Back</button>
    `;
  }
  if (step === 'pickCard') {
    return `
      <h2>${NODE_ICONS.rest} Infuse</h2>
      <p class="muted small">An infused card also adds its element when you play it.</p>
      ${deckGrid(run, (i) => {
        const card = run.deck[i];
        return card && canInfuse(card) ? '' : 'unplayable';
      })}
      <button class="text-button" data-action="back">Back</button>
    `;
  }
  if (step === 'pickElement' && deckIndex !== undefined) {
    const card = run.deck[deckIndex];
    return `
      <h2>${NODE_ICONS.rest} Infuse</h2>
      ${card ? `<section class="reward-cards">${cardFace(getCard(card.id), 'clear', { attrs: 'data-action="none"' })}</section>` : ''}
      <section class="element-choices">
        ${INFUSE_ELEMENTS.map(
          (e) => `<button class="element-choice" data-element="${e}" style="--chip-color: ${ELEMENTS[e].color}">
            ${ELEMENTS[e].icon}<small>${ELEMENTS[e].name}</small></button>`,
        ).join('')}
      </section>
      <button class="text-button" data-action="back">Back</button>
    `;
  }
  const heal = restHealAmount(run);
  return `
    <h2>${NODE_ICONS.rest} Rest site</h2>
    <p class="muted">Choose one:</p>
    <span class="title-buttons">
      <button class="primary-button" data-action="rest" ${heal > 0 ? '' : 'disabled'}>Rest: heal ${heal} HP</button>
      <button class="secondary-button" data-action="infuse">Infuse a card</button>
      <button class="secondary-button" data-action="chart" ${run.sky.length > MIN_SKY ? '' : 'disabled'}>
        ${ICONS.sky} Chart the sky
      </button>
    </span>
  `;
}

function renderShop(run: RunState, removing: boolean): string {
  const shop = run.shop;
  if (!shop) return '<p>The shop is closed.</p><button class="primary-button" data-action="leave">Leave</button>';
  if (removing) {
    return `
      <h2>${NODE_ICONS.shop} Remove a card</h2>
      <p class="muted small">Costs ${ICONS.gold} ${shop.removalPrice}.</p>
      ${deckGrid(run, () => '')}
      <button class="text-button" data-action="back">Back</button>
    `;
  }
  const price = (p: number, sold: boolean) =>
    `<span class="price ${sold ? 'sold' : run.gold < p ? 'too-expensive' : ''}">${sold ? 'Sold' : `${ICONS.gold} ${p}`}</span>`;
  return `
    <h2>${NODE_ICONS.shop} Shop</h2>
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
          const relic = getRelic(item.id);
          return `<button class="shop-relic ${item.sold ? 'sold' : ''}" data-buy-relic="${i}">
            <span class="relic-icon">${RELIC_ICONS[relic.id] ?? '❔'}</span>
            <span class="recipe-body"><strong>${esc(relic.name)}</strong> ${esc(relic.text)}</span>
            ${price(item.price, item.sold)}
          </button>`;
        })
        .join('')}
    </section>
    <section class="shop-relics">
      ${shop.potions
        .map((item, i) => {
          const recipe = getRecipe(item.id);
          return `<button class="shop-relic ${item.sold ? 'sold' : ''}" data-buy-potion="${i}">
            <span class="relic-icon">${ICONS.potion}</span>
            <span class="recipe-body"><strong>${esc(recipe.name)} potion</strong> ${esc(baseText(recipe))}</span>
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
            <span class="recipe-body"><strong>${esc(card.name)}</strong> weather card: ${esc(card.text)}</span>
            ${price(item.price, item.sold)}
          </button>`;
        })
        .join('')}
    </section>
    <button class="secondary-button" data-action="remove" ${shop.removalUsed ? 'disabled' : ''}>
      Remove a card (${ICONS.gold} ${shop.removalPrice})
    </button>
    <button class="primary-button" data-action="leave">Leave</button>
  `;
}

/** The deck as tappable cards; `extraClass(i)` can mark some unavailable. */
function deckGrid(run: RunState, extraClass: (index: number) => string): string {
  return `
    <section class="card-grid">
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
      <span class="recipe-panel" role="dialog" aria-label="Your deck" data-action="none">
        <span class="recipe-header">
          <h2>Deck (${run.deck.length})</h2>
          <button class="text-button" data-action="close">Close</button>
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

/** The sky deck as rows; `attrs(i)` makes them tappable. */
function skyList(run: RunState, attrs: (index: number) => string): string {
  return `
    <section class="shop-relics">
      ${run.sky
        .map((id, i) => {
          const card = getSkyCard(id);
          return `<button class="shop-relic" ${attrs(i)}>
            <span class="relic-icon">${WEATHERS[card.weather].icon}</span>
            <span class="recipe-body"><strong>${esc(card.name)}</strong> ${esc(card.text)}</span>
          </button>`;
        })
        .join('')}
    </section>
  `;
}

function renderSky(run: RunState): string {
  return `
    <span class="overlay" data-action="close">
      <span class="recipe-panel" role="dialog" aria-label="Your sky" data-action="none">
        <span class="recipe-header">
          <h2>${ICONS.sky} Sky (${run.sky.length})</h2>
          <button class="text-button" data-action="close">Close</button>
        </span>
        <span class="recipe-rules">
          Each fight's forecast is drawn from these weather cards. Buy more in shops;
          chart the sky at rest sites to remove one. Some enemies add their own weather.
        </span>
        <span class="deck-scroll">${skyList(run, () => 'data-action="none"')}</span>
      </span>
    </span>
  `;
}

function renderOver(run: RunState): string {
  const won = run.status === 'won';
  const node = currentNode(run);
  return `
    <main class="screen">
      <h2>${won ? 'Act 1 complete!' : 'Defeated'}</h2>
      <p>${
        won
          ? 'You defeated the Eye of the Storm.'
          : `You fell on floor ${node ? node.floor + 1 : 1} after winning ${run.fightsWon} fight${run.fightsWon === 1 ? '' : 's'}.`
      }</p>
      <p class="muted small">
        Deck: ${run.deck.length} cards · Relics: ${run.relics.map((id) => RELIC_ICONS[id] ?? '').join(' ')}
      </p>
      <span class="title-buttons">
        <button class="primary-button" data-action="new-run">New run</button>
        <button class="text-button" data-action="title">Back to title</button>
      </span>
    </main>
  `;
}
