import { describe, expect, it } from 'vitest';
import { MAX_POTIONS, createCombat, playCard, potionNeedsTarget, usePotion, type CombatSetup } from '../src/core/combat';
import { createGrimoire, discoverFrom, isKnown } from '../src/core/grimoire';
import { BOSS_ID, type MapNode } from '../src/core/map';
import {
  POTION_POOL,
  availableNodes,
  buyPotion,
  createRun,
  enterNode,
  finishFight,
  startFight,
  type RunState,
} from '../src/core/run';
import { SAVE_VERSION, makeRunSave, parseGrimoire, parseRunSave } from '../src/core/save';
import type { CombatEvent, CombatState } from '../src/core/types';
import { enemyHp } from './helpers/data';

const newCombat = (overrides: Partial<CombatSetup> = {}): CombatState =>
  createCombat({
    seed: 1,
    deck: ['bottleIt', 'gatherStone', 'gatherStone', 'stir', 'defend'],
    enemies: ['cinderImp'],
    playerHp: 50,
    playerMaxHp: 75,
    ...overrides,
  }).state;

const play = (s: CombatState, defId: string, target?: number) => {
  const card = s.hand.find((c) => c.defId === defId);
  if (!card) throw new Error(`no ${defId} in hand`);
  const result = playCard(s, card.uid, target);
  if (!result.ok) throw new Error(result.reason);
  return result.events;
};

describe('the Grimoire', () => {
  it('starts empty except for Sludge', () => {
    const g = createGrimoire();
    expect(isKnown(g, 'sludge')).toBe(true);
    expect(isKnown(g, 'fireball')).toBe(false);
  });

  it('learns recipes from brews, once', () => {
    const g = createGrimoire();
    const events: CombatEvent[] = [
      { type: 'brew', recipeId: 'fireball', used: ['fire', 'fire'] },
      { type: 'brew', recipeId: 'sludge', used: ['air'] },
      { type: 'brew', recipeId: 'fireball', used: ['fire', 'fire'] },
    ];
    expect(discoverFrom(g, events)).toEqual(['fireball']);
    expect(discoverFrom(g, events)).toEqual([]);
    expect(g.discovered).toEqual(['fireball']);
  });
});

describe('bottling and potions', () => {
  it('Bottle It turns the next brew into a potion instead of using it', () => {
    const s = newCombat();
    s.player.energy = 10;
    play(s, 'bottleIt');
    expect(s.bottleNext).toBe(1);
    play(s, 'gatherStone');
    play(s, 'gatherStone');
    const block = s.player.block;
    const events = play(s, 'stir');
    expect(events).toEqual([{ type: 'brew', recipeId: 'stoneskin', used: ['earth', 'earth'], bottled: true }]);
    expect(s.player.block).toBe(block);
    expect(s.potions).toEqual(['stoneskin']);
    expect(s.bottleNext).toBe(0);
  });

  it('Sludge is never bottled', () => {
    const s = newCombat({ deck: ['bottleIt', 'gatherDew', 'stir', 'defend', 'defend'] });
    s.player.energy = 10;
    play(s, 'bottleIt');
    play(s, 'gatherDew');
    play(s, 'stir');
    expect(s.potions).toEqual([]);
    expect(s.bottleNext).toBe(1);
  });

  it('a full potion belt means the brew is used as normal', () => {
    const s = newCombat({ potions: ['tonic', 'tonic', 'tonic'] });
    s.player.energy = 10;
    play(s, 'bottleIt');
    play(s, 'gatherStone');
    play(s, 'gatherStone');
    play(s, 'stir');
    expect(s.potions).toHaveLength(MAX_POTIONS);
    expect(s.player.block).toBe(4 + 4 + 12);
  });

  it('drinking a potion is free and applies its brew', () => {
    const s = newCombat({ potions: ['stoneskin', 'fireball'] });
    const energy = s.player.energy;
    expect(potionNeedsTarget(s, 0)).toBe(false);
    expect(usePotion(s, 0).ok).toBe(true);
    expect(s.player.block).toBe(12);
    expect(s.player.energy).toBe(energy);
    expect(s.potions).toEqual(['fireball']);
  });

  it('damage potions need a target', () => {
    const s = newCombat({ potions: ['fireball'] });
    expect(potionNeedsTarget(s, 0)).toBe(true);
    expect(usePotion(s, 0)).toEqual({ ok: false, reason: 'Choose an enemy.' });
    expect(usePotion(s, 0, 0).ok).toBe(true);
    expect(s.enemies[0]?.hp).toBe(enemyHp('cinderImp') - 12);
    expect(usePotion(s, 0).ok).toBe(false);
  });
});

/** Adds a node of the given type next to the player's position and walks there. */
const placeAt = (run: RunState, type: MapNode['type']): MapNode => {
  if (run.nodeId === null) enterNode(run, availableNodes(run)[0]?.id ?? '');
  const node: MapNode = { id: `test-${type}-${run.visited.length}`, floor: 5, lane: 0, type, next: [BOSS_ID] };
  run.map.nodes[node.id] = node;
  run.map.nodes[run.nodeId ?? '']?.next.push(node.id);
  return enterNode(run, node.id);
};

describe('potions in runs', () => {
  it('carry into fights and back out', () => {
    const run = createRun(1);
    run.potions = ['tonic'];
    placeAt(run, 'fight');
    const { state } = startFight(run);
    expect(state.potions).toEqual(['tonic']);
    state.potions.push('stoneskin');
    for (const enemy of state.enemies) enemy.hp = 0;
    state.status = 'won';
    finishFight(run, state);
    expect(run.potions.slice(0, 2)).toEqual(['tonic', 'stoneskin']);
  });

  it('sometimes drop after fights, from the base recipes', () => {
    const found = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const run = createRun(seed);
      placeAt(run, 'fight');
      const { state } = startFight(run);
      state.status = 'won';
      const rewards = finishFight(run, state);
      if (rewards.potion) {
        found.add(rewards.potion);
        expect(run.potions).toEqual([rewards.potion]);
      }
    }
    expect(found.size).toBeGreaterThan(0);
    for (const id of found) expect(POTION_POOL).toContain(id);
  });

  it('are sold in shops, if the belt has room', () => {
    const run = createRun(2);
    placeAt(run, 'shop');
    run.gold = 1000;
    expect(run.shop?.potions).toHaveLength(1);
    expect(buyPotion(run, 0).ok).toBe(true);
    expect(run.potions).toHaveLength(1);
    const run2 = createRun(3);
    placeAt(run2, 'shop');
    run2.gold = 1000;
    run2.potions = ['tonic', 'tonic', 'tonic'];
    expect(buyPotion(run2, 0)).toEqual({ ok: false, reason: 'Your potion belt is full.' });
  });
});

describe('saving', () => {
  it('round-trips a run, including a fight in progress', () => {
    const run = createRun(4);
    placeAt(run, 'fight');
    const { state } = startFight(run);
    playCard(state, state.hand[0]?.uid ?? -1, 0);
    const save = makeRunSave(run, { name: 'combat', label: 'Floor 6' }, state);
    const loaded = parseRunSave(JSON.stringify(save));
    expect(loaded).toEqual(save);
  });

  it('ignores missing, corrupt, outdated and finished saves', () => {
    const run = createRun(5);
    const good = makeRunSave(run, { name: 'map' });
    expect(parseRunSave(null)).toBeNull();
    expect(parseRunSave('not json')).toBeNull();
    expect(parseRunSave(JSON.stringify({ ...good, version: SAVE_VERSION + 1 }))).toBeNull();
    expect(parseRunSave(JSON.stringify({ ...good, run: { ...run, status: 'lost' } }))).toBeNull();
    expect(parseRunSave(JSON.stringify({ ...good, screen: { name: 'combat', label: 'x' } }))).toBeNull();
    expect(parseRunSave(JSON.stringify(good))).toEqual(good);
  });

  it('loads a Grimoire and ignores bad data', () => {
    expect(parseGrimoire(JSON.stringify({ discovered: ['fireball', 3] }))).toEqual({ discovered: ['fireball'] });
    expect(parseGrimoire('{')).toBeNull();
    expect(parseGrimoire(JSON.stringify({}))).toBeNull();
  });
});
