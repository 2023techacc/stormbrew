import { describe, expect, it } from 'vitest';
import { endTurn } from '../src/core/combat';
import { BOSS_ID, type MapNode, type NodeType } from '../src/core/map';
import {
  EASY_FLOORS,
  GOLD_REWARD,
  PLAYER_MAX_HP,
  REWARD_CHOICES,
  STARTING_GOLD,
  addCardToDeck,
  availableNodes,
  buyCard,
  buyRelic,
  createRun,
  enterNode,
  finishFight,
  infuseCard,
  removeCard,
  rest,
  startFight,
  type RunState,
} from '../src/core/run';
import type { CombatState } from '../src/core/types';
import { REWARD_POOL, STARTER_DECK } from '../src/data/cards';
import { ENCOUNTERS } from '../src/data/enemies';
import { LAST_ACT } from '../src/data/acts';
import { RELIC_POOL } from '../src/data/relics';

const win = (state: CombatState) => {
  for (const enemy of state.enemies) enemy.hp = 0;
  state.status = 'won';
  return state;
};

/** Adds a node of the given type next to the player's position and walks there. */
const placeAt = (run: RunState, type: NodeType, floor = 5): MapNode => {
  if (run.nodeId === null) enterNode(run, availableNodes(run)[0]?.id ?? '');
  const node: MapNode = { id: `test-${type}-${floor}`, floor, lane: 0, type, next: [BOSS_ID] };
  run.map.nodes[node.id] = node;
  run.map.nodes[run.nodeId ?? '']?.next.push(node.id);
  return enterNode(run, node.id);
};

describe('runs', () => {
  it('start with full HP, starting gold, the starter deck and the Copper Cauldron', () => {
    const run = createRun(1);
    expect(run.hp).toBe(PLAYER_MAX_HP);
    expect(run.gold).toBe(STARTING_GOLD);
    expect(run.deck.map((c) => c.id)).toEqual(STARTER_DECK);
    expect(run.relics).toEqual(['copperCauldron']);
    expect(run.status).toBe('playing');
  });

  it('are deterministic for the same seed', () => {
    expect(createRun(9)).toEqual(createRun(9));
  });

  it('start on floor 0 and can only move along the map', () => {
    const run = createRun(2);
    const first = availableNodes(run);
    expect(first.length).toBeGreaterThan(0);
    for (const node of first) expect(node.floor).toBe(0);
    const node = enterNode(run, first[0]?.id ?? '');
    expect(run.visited).toEqual([node.id]);
    expect(availableNodes(run).map((n) => n.id)).toEqual(node.next);
    const unreachable = Object.values(run.map.nodes).find((n) => n.floor === 5);
    expect(() => enterNode(run, unreachable?.id ?? '')).toThrow();
  });

  it('use easy encounters on the first floors, and elites/boss at their nodes', () => {
    const key = (s: CombatState) => s.enemies.map((e) => e.defId).join(',');
    const pool = (tier: string[][]) => tier.map((t) => t.join(','));
    const run = createRun(3);
    placeAt(run, 'fight', EASY_FLOORS - 1);
    expect(pool(ENCOUNTERS.easy)).toContain(key(startFight(run).state));
    placeAt(run, 'fight', EASY_FLOORS);
    expect(pool(ENCOUNTERS.hard)).toContain(key(startFight(run).state));
    placeAt(run, 'elite');
    expect(pool(ENCOUNTERS.elite)).toContain(key(startFight(run).state));
    placeAt(run, 'boss');
    expect(key(startFight(run).state)).toBe('eyeOfTheStorm');
  });

  it('pass the deck, HP and relics into fights', () => {
    const run = createRun(4);
    run.hp = 50;
    run.deck[0] = { id: 'strike', infusion: 'fire' };
    placeAt(run, 'fight');
    const { state } = startFight(run);
    expect(state.player.hp).toBe(50);
    expect(state.relics).toEqual(['copperCauldron']);
    const all = [...state.drawPile, ...state.hand, ...state.discardPile];
    expect(all.filter((c) => c.infusion === 'fire')).toHaveLength(1);
  });
});

describe('fight rewards', () => {
  it('a won fight gives gold and card choices, and keeps the HP from the fight', () => {
    const run = createRun(5);
    placeAt(run, 'fight');
    const state = startFight(run).state;
    state.player.hp = 40;
    const rewards = finishFight(run, win(state));
    expect(rewards.gold).toBeGreaterThanOrEqual(GOLD_REWARD.fight[0]);
    expect(rewards.gold).toBeLessThanOrEqual(GOLD_REWARD.fight[1]);
    expect(run.gold).toBe(STARTING_GOLD + rewards.gold);
    expect(run.hp).toBe(40);
    expect(rewards.cardChoices).toHaveLength(REWARD_CHOICES);
    expect(new Set(rewards.cardChoices).size).toBe(REWARD_CHOICES);
    for (const id of rewards.cardChoices) expect(REWARD_POOL).toContain(id);
    expect(rewards.relic).toBeUndefined();
  });

  it('elites give more gold and a new relic', () => {
    const run = createRun(6);
    placeAt(run, 'elite');
    const rewards = finishFight(run, win(startFight(run).state));
    expect(rewards.gold).toBeGreaterThanOrEqual(GOLD_REWARD.elite[0]);
    expect(RELIC_POOL).toContain(rewards.relic);
    expect(run.relics).toContain(rewards.relic);
  });

  it("beating the last act's boss wins the run", () => {
    const run = createRun(7);
    run.act = LAST_ACT;
    placeAt(run, 'boss');
    finishFight(run, win(startFight(run).state));
    expect(run.status).toBe('won');
    expect(availableNodes(run)).toEqual([]);
  });

  it('losing a fight ends the run', () => {
    const run = createRun(8);
    placeAt(run, 'fight');
    const { state } = startFight(run);
    state.player.hp = 1;
    while (state.status === 'playing') endTurn(state);
    finishFight(run, state);
    expect(run.status).toBe('lost');
    expect(run.hp).toBe(0);
  });

  it('Healing Herb heals and Lucky Coin adds gold after a fight', () => {
    const run = createRun(9);
    run.relics.push('healingHerb', 'luckyCoin');
    placeAt(run, 'fight');
    const state = startFight(run).state;
    state.player.hp = 30;
    const rewards = finishFight(run, win(state));
    expect(rewards.healed).toBe(6);
    expect(run.hp).toBe(36);
    expect(rewards.gold).toBeGreaterThanOrEqual(GOLD_REWARD.fight[0] + 10);
  });

  it('chosen cards join the deck', () => {
    const run = createRun(10);
    addCardToDeck(run, 'thunderclap');
    expect(run.deck.at(-1)).toEqual({ id: 'thunderclap' });
    expect(() => addCardToDeck(run, 'notACard')).toThrow();
  });
});

describe('rest sites', () => {
  it('resting heals 30% of max HP, up to max', () => {
    const run = createRun(11);
    run.hp = 40;
    const heal = Math.ceil(PLAYER_MAX_HP * 0.3);
    expect(rest(run)).toBe(heal);
    expect(run.hp).toBe(40 + heal);
    expect(rest(run)).toBe(PLAYER_MAX_HP - 40 - heal);
    expect(run.hp).toBe(PLAYER_MAX_HP);
  });

  it('infusing adds an element to a card once', () => {
    const run = createRun(12);
    infuseCard(run, 0, 'water');
    expect(run.deck[0]).toEqual({ id: STARTER_DECK[0], infusion: 'water' });
    expect(() => infuseCard(run, 0, 'fire')).toThrow();
    expect(() => infuseCard(run, 1, 'spark')).toThrow();
  });
});

describe('shops', () => {
  it('stock 3 cards, 2 new relics and a card removal', () => {
    const run = createRun(13);
    placeAt(run, 'shop');
    expect(run.shop?.cards).toHaveLength(3);
    expect(run.shop?.relics).toHaveLength(2);
    for (const item of run.shop?.relics ?? []) expect(run.relics).not.toContain(item.id);
  });

  it('sell cards and relics for gold, once each', () => {
    const run = createRun(14);
    placeAt(run, 'shop');
    run.gold = 1000;
    const card = run.shop?.cards[0];
    expect(buyCard(run, 0)).toEqual({ ok: true });
    expect(run.deck.at(-1)?.id).toBe(card?.id);
    expect(run.gold).toBe(1000 - (card?.price ?? 0));
    expect(buyCard(run, 0)).toEqual({ ok: false, reason: 'Sold out.' });
    const relic = run.shop?.relics[0];
    expect(buyRelic(run, 0).ok).toBe(true);
    expect(run.relics).toContain(relic?.id);
  });

  it('refuse purchases without enough gold', () => {
    const run = createRun(15);
    placeAt(run, 'shop');
    run.gold = 5;
    const deckSize = run.deck.length;
    expect(buyCard(run, 0)).toEqual({ ok: false, reason: 'Not enough gold.' });
    expect(buyRelic(run, 0)).toEqual({ ok: false, reason: 'Not enough gold.' });
    expect(run.deck).toHaveLength(deckSize);
    expect(run.gold).toBe(5);
  });

  it('remove one card per visit', () => {
    const run = createRun(16);
    placeAt(run, 'shop');
    run.gold = 1000;
    const size = run.deck.length;
    expect(removeCard(run, 0).ok).toBe(true);
    expect(run.deck).toHaveLength(size - 1);
    expect(removeCard(run, 0)).toEqual({ ok: false, reason: 'Card removal is used up.' });
  });

  it('are only open while you are in one', () => {
    const run = createRun(17);
    run.gold = 1000;
    expect(buyCard(run, 0).ok).toBe(false);
    expect(removeCard(run, 0).ok).toBe(false);
  });
});
