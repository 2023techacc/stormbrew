import { describe, expect, it } from 'vitest';
import { CAULDRON_SLOTS } from '../src/core/brewing';
import {
  MAX_POTIONS,
  PLAYER_MAX_ENERGY,
  THUNDER_DRUM_BOLTS,
  createCombat,
  endTurn,
  playCard,
  potionCapacity,
  toggleExposure,
  type CombatSetup,
} from '../src/core/combat';
import { BOSS_ID, MAP_FLOORS, type MapNode, type NodeType } from '../src/core/map';
import {
  BOSS_RELIC_CHOICES,
  EASY_FLOORS,
  GOLD_REWARD,
  availableNodes,
  createRun,
  enterNode,
  finishFight,
  runFloor,
  startFight,
  startNextAct,
  takeBossRelic,
  type RunState,
} from '../src/core/run';
import { SAVE_VERSION, makeRunSave, parseRunSave } from '../src/core/save';
import type { CombatState } from '../src/core/types';
import { ACTS, LAST_ACT, getAct } from '../src/data/acts';
import { BOSS_RELIC_POOL, RELIC_POOL } from '../src/data/relics';

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

const key = (state: CombatState) => state.enemies.map((e) => e.defId).join('+');
const pool = (groups: string[][]) => groups.map((g) => g.join('+'));

const newCombat = (overrides: Partial<CombatSetup> = {}): CombatState =>
  createCombat({
    seed: 3,
    deck: ['strike', 'strike', 'defend', 'defend', 'stir', 'gatherEmber', 'gatherDew'],
    enemies: ['trainingDummy'],
    playerHp: 80,
    playerMaxHp: 80,
    ...overrides,
  }).state;

describe('acts', () => {
  it('a run has three acts, each with its own enemies and boss', () => {
    expect(ACTS.map((a) => a.number)).toEqual([1, 2, 3]);
    expect(LAST_ACT).toBe(3);
    const bosses = ACTS.map((a) => a.encounters.boss.flat().join());
    expect(new Set(bosses).size).toBe(3);
  });

  it("beating an act's boss offers boss relics, gold and cards, and the run goes on", () => {
    const run = createRun(21);
    placeAt(run, 'boss', MAP_FLOORS);
    const rewards = finishFight(run, win(startFight(run).state));
    expect(run.status).toBe('playing');
    expect(rewards.bossRelics).toHaveLength(BOSS_RELIC_CHOICES);
    for (const id of rewards.bossRelics ?? []) expect(BOSS_RELIC_POOL).toContain(id);
    expect(rewards.gold).toBeGreaterThanOrEqual(GOLD_REWARD.boss[0]);
    expect(rewards.cardChoices.length).toBeGreaterThan(0);
  });

  it('boss relics are only offered after bosses', () => {
    for (const id of BOSS_RELIC_POOL) expect(RELIC_POOL).not.toContain(id);
  });

  it('you take one offered boss relic', () => {
    const run = createRun(22);
    placeAt(run, 'boss', MAP_FLOORS);
    const rewards = finishFight(run, win(startFight(run).state));
    const offered = rewards.bossRelics ?? [];
    const notOffered = BOSS_RELIC_POOL.find((id) => !offered.includes(id)) ?? 'stormVow';
    expect(() => takeBossRelic(run, rewards, notOffered)).toThrow();
    takeBossRelic(run, rewards, offered[0] ?? '');
    expect(run.relics).toContain(offered[0]);
    expect(rewards.bossRelics).toBeUndefined();
  });

  it('the next act starts on a new map with full HP', () => {
    const run = createRun(23);
    placeAt(run, 'boss', MAP_FLOORS);
    finishFight(run, win(startFight(run).state));
    run.hp = 20;
    const oldMap = run.map;
    expect(startNextAct(run)).toBe(run.maxHp - 20);
    expect(run.act).toBe(2);
    expect(run.hp).toBe(run.maxHp);
    expect(run.map).not.toBe(oldMap);
    expect(run.nodeId).toBeNull();
    expect(run.visited).toEqual([]);
    expect(availableNodes(run).every((n) => n.floor === 0)).toBe(true);
  });

  it("fights in a later act use that act's enemies", () => {
    const run = createRun(24);
    run.act = 2;
    const act2 = getAct(2).encounters;
    placeAt(run, 'fight', 0);
    expect(pool(act2.easy)).toContain(key(startFight(run).state));
    placeAt(run, 'fight', EASY_FLOORS + 1);
    expect(pool(act2.hard)).toContain(key(startFight(run).state));
    placeAt(run, 'elite', 6);
    expect(pool(act2.elite)).toContain(key(startFight(run).state));
    placeAt(run, 'boss', MAP_FLOORS);
    expect(pool(act2.boss)).toContain(key(startFight(run).state));
  });

  it('there is no act after the last one', () => {
    const run = createRun(25);
    run.act = LAST_ACT;
    expect(() => startNextAct(run)).toThrow();
  });

  it('floors count on from one act to the next', () => {
    const run = createRun(26);
    const first = availableNodes(run)[0];
    expect(runFloor(run, first)).toBe(1);
    run.act = 2;
    expect(runFloor(run, first)).toBe(MAP_FLOORS + 2);
  });

  it('a run saved before acts existed still loads, in Act 1', () => {
    const run = createRun(27);
    const old = JSON.parse(JSON.stringify(makeRunSave(run, { name: 'map' }))) as Record<string, unknown>;
    old.version = 4;
    delete (old.run as Partial<RunState>).act;
    const loaded = parseRunSave(JSON.stringify(old));
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.run.act).toBe(1);
  });
});

describe('boss relics in fights', () => {
  it('the Storm Vow gives energy but keeps you out in the open', () => {
    const s = newCombat({ relics: ['stormVow'] });
    expect(s.player.maxEnergy).toBe(PLAYER_MAX_ENERGY + 1);
    expect(toggleExposure(s)).toEqual([]);
    expect(s.player.exposed).toBe(true);
    s.player.exposed = false; // even if something tries to take cover
    endTurn(s);
    expect(s.player.exposed).toBe(true);
  });

  it('the Sky Anchor gives energy, and the weather never changes on its own', () => {
    const s = newCombat({ relics: ['skyAnchor'], startWeather: 'rain' });
    expect(s.player.maxEnergy).toBe(PLAYER_MAX_ENERGY + 1);
    for (let turn = 0; turn < 8; turn++) endTurn(s);
    expect(s.weather.current).toBe('rain');
  });

  it("the Philosopher's Stone gives energy but shrinks the cauldron", () => {
    const s = newCombat({ relics: ['philosophersStone'] });
    expect(s.player.maxEnergy).toBe(PLAYER_MAX_ENERGY + 1);
    expect(s.cauldronSlots).toBe(CAULDRON_SLOTS - 1);
  });

  it('the Grand Grimoire draws a card whenever you brew', () => {
    const deck = ['stir', 'strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend'];
    const s = newCombat({ deck, relics: ['grandGrimoire'] });
    s.cauldron = ['fire', 'water'];
    const stir = s.hand.find((c) => c.defId === 'stir');
    if (!stir) throw new Error('no Stir in hand');
    const before = s.hand.length;
    const result = playCard(s, stir.uid, 0);
    expect(result.ok).toBe(true);
    // Stir left the hand, and the brew drew one: the same number of cards.
    expect(s.hand.length).toBe(before);
  });

  it('the Bottomless Flask carries more potions and brings one to each fight', () => {
    expect(potionCapacity(['bottomlessFlask'])).toBeGreaterThan(MAX_POTIONS);
    const s = newCombat({ relics: ['bottomlessFlask'] });
    expect(s.potions).toHaveLength(1);
  });

  it('the Thunder Drum: lightning spares you and strikes the enemies twice', () => {
    const s = newCombat({ relics: ['thunderDrum'], startWeather: 'storm', enemies: ['trainingDummy'] });
    const events = endTurn(s);
    const bolts = events.filter((e) => e.type === 'damage' && e.source === 'lightning');
    expect(bolts).toHaveLength(THUNDER_DRUM_BOLTS);
    expect(bolts.every((e) => e.type === 'damage' && e.target.side === 'enemy')).toBe(true);
  });
});

describe('new enemy moves', () => {
  it('a many-hit attack hits several times, and Block soaks each hit', () => {
    // The Ice Bat's Swoop: two hits.
    const s = newCombat({ enemies: ['iceBat'] });
    toggleExposure(s); // under cover: no hunter bonus
    s.player.block = 3;
    const events = endTurn(s);
    const hits = events.filter((e) => e.type === 'damage' && e.target.side === 'player');
    expect(hits).toHaveLength(2);
  });

  it('an enemy can heal itself, up to its max HP', () => {
    const s = newCombat({ enemies: ['grandAlchemist'], playerHp: 500, playerMaxHp: 500 });
    const enemy = s.enemies[0];
    if (!enemy) throw new Error('no enemy');
    enemy.moveIndex = 1; // Elixir
    enemy.hp = enemy.maxHp - 5;
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'enemyHeal', index: 0, amount: 5 });
    expect(enemy.hp).toBe(enemy.maxHp);
  });

  it('a shattering attack breaks all your Block first', () => {
    const s = newCombat({ enemies: ['frostMammoth'], playerHp: 500, playerMaxHp: 500 });
    const enemy = s.enemies[0];
    if (!enemy) throw new Error('no enemy');
    enemy.moveIndex = 1; // Trample
    s.player.block = 30;
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'shatter', amount: 30 });
    const hit = events.find((e) => e.type === 'damage' && e.target.side === 'player');
    expect(hit && hit.type === 'damage' && hit.blocked).toBe(0);
  });
});
