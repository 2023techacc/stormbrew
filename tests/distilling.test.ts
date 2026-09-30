import { describe, expect, it } from 'vitest';
import { createCombat, endTurn, playCard, toggleExposure } from '../src/core/combat';
import { BOSS_ID, type MapNode } from '../src/core/map';
import {
  MAX_DISTILLED,
  REWARD_CHOICES,
  availableNodes,
  createRun,
  enterNode,
  finishFight,
  rewardChoices,
  startFight,
  type RunState,
} from '../src/core/run';
import { CARDS, RARE_POOL, REWARD_POOL, STARTER_DECK, getCard } from '../src/data/cards';
import { DISTILLED_CARDS, distilledRecipe, essenceId, flaskId } from '../src/data/distilled';
import { RECIPES } from '../src/data/recipes';
import { autoplayRun } from './helpers/autoplay';
import { enemyHp } from './helpers/data';

const placeAt = (run: RunState, type: MapNode['type']): MapNode => {
  if (run.nodeId === null) enterNode(run, availableNodes(run)[0]?.id ?? '');
  const node: MapNode = { id: `test-${type}-${run.visited.length}`, floor: 5, lane: 0, type, next: [BOSS_ID] };
  run.map.nodes[node.id] = node;
  run.map.nodes[run.nodeId ?? '']?.next.push(node.id);
  return enterNode(run, node.id);
};

describe('distilled cards', () => {
  it('every recipe makes a Flask and an Essence', () => {
    expect(Object.keys(DISTILLED_CARDS)).toHaveLength(RECIPES.length * 2);
    for (const recipe of RECIPES) {
      const flask = getCard(flaskId(recipe.id));
      const essence = getCard(essenceId(recipe.id));
      expect(flask.effects).toEqual(recipe.effects);
      expect(essence.effects).toEqual(recipe.elements.map((element) => ({ type: 'addElement', element })));
      expect(flask.cost).toBe(recipe.elements.length - 1);
      expect(distilledRecipe(flask.id)).toBe(recipe.id);
      expect(distilledRecipe(essence.id)).toBe(recipe.id);
    }
    expect(distilledRecipe('strike')).toBeUndefined();
  });

  it("don't clash with normal card ids", () => {
    for (const id of Object.keys(DISTILLED_CARDS)) expect(CARDS[id]).toBeUndefined();
  });

  it('a Flask plays like its brew', () => {
    const s = createCombat({ seed: 1, deck: [flaskId('fireball')], enemies: ['cinderImp'], playerHp: 75, playerMaxHp: 75 }).state;
    const card = s.hand[0];
    if (!card) throw new Error('empty hand');
    expect(playCard(s, card.uid, 0).ok).toBe(true);
    expect(s.enemies[0]?.hp).toBe(enemyHp('cinderImp') - 12);
  });

  it("an Essence adds its recipe's elements", () => {
    const s = createCombat({ seed: 1, deck: [essenceId('thunderhead')], enemies: ['cinderImp'], playerHp: 75, playerMaxHp: 75 }).state;
    const card = s.hand[0];
    if (!card) throw new Error('empty hand');
    expect(playCard(s, card.uid).ok).toBe(true);
    expect([...s.cauldron].sort()).toEqual(['air', 'spark', 'water']);
  });
});

describe('distilling rewards', () => {
  it('fights remember what was brewed, by you or by enemies', () => {
    const s = createCombat({ seed: 1, deck: ['gatherStone', 'gatherStone', 'stir'], enemies: ['mireWitch'], playerHp: 75, playerMaxHp: 75 }).state;
    toggleExposure(s);
    s.player.energy = 10;
    for (const id of ['gatherStone', 'gatherStone', 'stir']) {
      const card = s.hand.find((c) => c.defId === id);
      if (card) playCard(s, card.uid, 0);
    }
    endTurn(s);
    endTurn(s); // the witch brews Fireball
    expect(s.brewed).toEqual(['stoneskin', 'fireball']);
  });

  it('offer up to two distilled cards and always at least one random card', () => {
    const run = createRun(1);
    for (let i = 0; i < 20; i++) {
      const choices = rewardChoices(run, ['fireball', 'steam', 'magma', 'mud']);
      expect(choices).toHaveLength(REWARD_CHOICES);
      const distilled = choices.filter((id) => distilledRecipe(id));
      expect(distilled).toHaveLength(MAX_DISTILLED);
      expect([...REWARD_POOL, ...RARE_POOL]).toContain(choices.at(-1));
    }
  });

  it('with nothing brewed, all choices are random cards', () => {
    const choices = rewardChoices(createRun(2), []);
    for (const id of choices) expect([...REWARD_POOL, ...RARE_POOL]).toContain(id);
  });

  it('a recipe already in the deck comes back only rarely', () => {
    const run = createRun(3);
    run.deck.push({ id: flaskId('fireball') });
    let offered = 0;
    for (let i = 0; i < 400; i++) {
      if (rewardChoices(run, ['fireball']).some((id) => distilledRecipe(id) === 'fireball')) offered++;
    }
    // REPEAT_DISTILL_CHANCE is 25%: well below "always", but not never.
    expect(offered).toBeGreaterThan(50);
    expect(offered).toBeLessThan(160);
  });

  it('finishing a fight offers distilled cards from it', () => {
    const run = createRun(4);
    placeAt(run, 'fight');
    const { state } = startFight(run);
    state.brewed = ['iceLance'];
    for (const enemy of state.enemies) enemy.hp = 0;
    state.status = 'won';
    const rewards = finishFight(run, state);
    expect(rewards.cardChoices.some((id) => distilledRecipe(id) === 'iceLance')).toBe(true);
  });
});

describe('deck diversity', () => {
  /** Non-starter cards in a finished run's deck. */
  const added = (run: RunState) => run.deck.slice(STARTER_DECK.length).map((c) => c.id);

  const measure = (distill: boolean) => {
    const decks = Array.from({ length: 60 }, (_, seed) => added(autoplayRun(seed + 1, { distill })));
    const withCards = decks.filter((d) => d.length > 0);
    const uniqueness = withCards.reduce((sum, d) => sum + new Set(d).size / d.length, 0) / withCards.length;
    let similarity = 0;
    let pairs = 0;
    for (let i = 0; i < withCards.length; i++) {
      for (let j = i + 1; j < withCards.length; j++) {
        const a = new Set(withCards[i]);
        const b = new Set(withCards[j]);
        const shared = [...a].filter((x) => b.has(x)).length;
        similarity += shared / new Set([...a, ...b]).size;
        pairs++;
      }
    }
    const distinctAcrossRuns = new Set(withCards.flat()).size;
    return { uniqueness, similarity: similarity / pairs, distinctAcrossRuns, avgAdded: withCards.flat().length / withCards.length };
  };

  it('distilling does not make decks less varied', () => {
    const without = measure(false);
    const withDistill = measure(true);
    console.log('diversity without distilling:', without);
    console.log('diversity with distilling:   ', withDistill);
    // Within a deck: about as many different cards per card added.
    expect(withDistill.uniqueness).toBeGreaterThanOrEqual(without.uniqueness * 0.95);
    // Across runs: decks are no more alike than before.
    expect(withDistill.similarity).toBeLessThanOrEqual(without.similarity * 1.05);
  });
});
