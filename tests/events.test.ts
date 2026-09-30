import { describe, expect, it } from 'vitest';
import {
  canPickEventCard,
  cancelEventPick,
  chooseEventOption,
  currentEvent,
  eventCardOptions,
  eventOptionBlocked,
  eventSkyOptions,
  pickEventCard,
  pickEventReward,
  pickEventSky,
} from '../src/core/events';
import { createGrimoire, type Grimoire } from '../src/core/grimoire';
import { BOSS_ID, type MapNode } from '../src/core/map';
import {
  MIN_SKY,
  availableNodes,
  createRun,
  enterNode,
  finishFight,
  startFight,
  type RunState,
} from '../src/core/run';
import { makeRunSave, parseRunSave } from '../src/core/save';
import { RARE_POOL } from '../src/data/cards';
import { ENCOUNTERS } from '../src/data/enemies';
import { EVENT_IDS, eventInAct, getEvent } from '../src/data/events';
import { RECIPES } from '../src/data/recipes';

/** Adds an event spot next to the player and walks there. */
const atEvent = (run: RunState, id?: string): MapNode => {
  if (run.nodeId === null) enterNode(run, availableNodes(run)[0]?.id ?? '');
  const node: MapNode = { id: `test-event-${run.visited.length}`, floor: 5, lane: 0, type: 'event', next: [BOSS_ID] };
  run.map.nodes[node.id] = node;
  run.map.nodes[run.nodeId ?? '']?.next.push(node.id);
  const entered = enterNode(run, node.id);
  if (id) run.event = { id };
  return entered;
};

const choose = (run: RunState, optionId: string, grimoire: Grimoire = createGrimoire()) => {
  const result = chooseEventOption(run, optionId, grimoire);
  if (!result.ok) throw new Error(result.reason);
  return result;
};

const option = (eventId: string, optionId: string) => {
  const found = getEvent(eventId).options.find((o) => o.id === optionId);
  if (!found) throw new Error(`no option ${optionId}`);
  return found;
};

describe('events on the map', () => {
  it("entering an event picks one of the act's events you have not seen this run", () => {
    for (const act of [1, 2, 3]) {
      const run = createRun(act);
      run.act = act;
      const pool = EVENT_IDS.filter((id) => eventInAct(id, act));
      const seen: string[] = [];
      for (let i = 0; i < pool.length; i++) {
        atEvent(run);
        const id = run.event?.id ?? '';
        expect(pool).toContain(id);
        expect(seen).not.toContain(id);
        seen.push(id);
      }
      // Once every event has been seen, they can come again.
      atEvent(run);
      expect(pool).toContain(run.event?.id);
    }
  });

  it('some events only happen in later acts', () => {
    expect(eventInAct('frozenLake', 1)).toBe(false);
    expect(eventInAct('frozenLake', 2)).toBe(true);
    expect(eventInAct('stormAltar', 3)).toBe(true);
    expect(eventInAct('abandonedCauldron', 3)).toBe(true);
    for (const act of [1, 2, 3]) expect(EVENT_IDS.filter((id) => eventInAct(id, act)).length).toBeGreaterThanOrEqual(6);
  });

  it('leaving an event or choosing ends it', () => {
    const run = createRun(2);
    atEvent(run, 'struckOak');
    const before = structuredClone(run);
    expect(choose(run, 'leave')).toEqual({ ok: true, next: 'map', message: '' });
    expect(run.event).toBeUndefined();
    expect({ ...run, event: before.event }).toEqual(before);
  });

  it('an event waiting on a pick survives saving', () => {
    const run = createRun(3);
    atEvent(run, 'weatherShrine');
    run.gold = 100;
    choose(run, 'offer');
    const save = makeRunSave(run, { name: 'event', step: 'pickSky' });
    expect(parseRunSave(JSON.stringify(save))).toEqual(save);
  });
});

describe('the Abandoned Cauldron', () => {
  it('drinking heals', () => {
    const run = createRun(4);
    atEvent(run, 'abandonedCauldron');
    run.hp = 50;
    expect(choose(run, 'drink').message).toBe('Healed 15 HP.');
    expect(run.hp).toBe(65);
  });

  it('studying teaches recipes you did not know, until you know them all', () => {
    const run = createRun(5);
    atEvent(run, 'abandonedCauldron');
    const grimoire = createGrimoire();
    grimoire.discovered.push('fireball');
    choose(run, 'study', grimoire);
    expect(grimoire.discovered).toHaveLength(3);
    expect(new Set(grimoire.discovered).size).toBe(3);
    const all = { discovered: RECIPES.map((r) => r.id) };
    expect(eventOptionBlocked(run, option('abandonedCauldron', 'study'), all)).toBe('You know every recipe.');
  });

  it('bottling needs room on the potion belt', () => {
    const run = createRun(6);
    atEvent(run, 'abandonedCauldron');
    choose(run, 'bottle');
    expect(run.potions).toHaveLength(1);
    run.potions = ['tonic', 'tonic', 'tonic'];
    expect(eventOptionBlocked(run, option('abandonedCauldron', 'bottle'), createGrimoire())).toBe(
      'Your potion belt is full.',
    );
  });
});

describe('the Lightning-Struck Oak', () => {
  it('carves a Spark infusion into a card you pick', () => {
    const run = createRun(7);
    atEvent(run, 'struckOak');
    run.deck[1] = { id: 'strike', infusion: 'fire' };
    expect(choose(run, 'carve').next).toBe('pickCard');
    expect(canPickEventCard(run, 1)).toBe(false); // already infused
    const result = pickEventCard(run, 0, createGrimoire());
    expect(result.ok).toBe(true);
    expect(run.deck[0]?.infusion).toBe('spark');
    expect(run.event).toBeUndefined();
  });

  it('the heartwood raises max HP', () => {
    const run = createRun(8);
    atEvent(run, 'struckOak');
    const { hp, maxHp } = run;
    choose(run, 'heartwood');
    expect(run.maxHp).toBe(maxHp + 5);
    expect(run.hp).toBe(hp + 5);
  });
});

describe('the Weather Shrine', () => {
  it('an offering is paid only when you pick, and the choices stay the same', () => {
    const run = createRun(9);
    atEvent(run, 'weatherShrine');
    run.gold = 100;
    expect(choose(run, 'offer').next).toBe('pickSky');
    const offered = eventSkyOptions(run);
    expect(offered).toHaveLength(3);
    expect(run.gold).toBe(100);
    cancelEventPick(run);
    choose(run, 'offer');
    expect(eventSkyOptions(run)).toEqual(offered);
    const sky = run.sky.length;
    expect(pickEventSky(run, 1, createGrimoire()).ok).toBe(true);
    expect(run.gold).toBe(75);
    expect(run.sky).toHaveLength(sky + 1);
    expect(run.sky.at(-1)).toBe(offered[1]);
  });

  it('praying for calm removes a weather card, but the sky keeps a minimum', () => {
    const run = createRun(10);
    atEvent(run, 'weatherShrine');
    choose(run, 'calm');
    const [first] = run.sky;
    pickEventSky(run, 0, createGrimoire());
    expect(run.sky).toHaveLength(4);
    expect(run.sky).not.toContain(first);
    run.sky = run.sky.slice(0, MIN_SKY);
    expect(eventOptionBlocked(run, option('weatherShrine', 'calm'), createGrimoire())).not.toBeNull();
  });
});

describe('the Storm Chaser', () => {
  it('chasing the storm is an elite fight with an elite reward', () => {
    const run = createRun(11);
    atEvent(run, 'stormChaser');
    expect(choose(run, 'chase').next).toBe('fight');
    const { state } = startFight(run);
    const elites = ENCOUNTERS.elite.map((group) => group.join('+'));
    expect(elites).toContain(state.enemies.map((e) => e.defId).join('+'));
    for (const enemy of state.enemies) enemy.hp = 0;
    state.status = 'won';
    const rewards = finishFight(run, state);
    expect(rewards.relic).toBeDefined();
    expect(run.event).toBeUndefined();
  });

  it('buying their gear costs gold', () => {
    const run = createRun(12);
    atEvent(run, 'stormChaser');
    run.gold = 50;
    expect(eventOptionBlocked(run, option('stormChaser', 'buy'), createGrimoire())).toBe('Not enough gold.');
    run.gold = 100;
    const relics = run.relics.length;
    choose(run, 'buy');
    expect(run.gold).toBe(20);
    expect(run.relics).toHaveLength(relics + 1);
  });
});

describe('the Frozen Traveler', () => {
  it('thawing them costs HP and gives a relic, but not when it would be too dangerous', () => {
    const run = createRun(13);
    atEvent(run, 'frozenTraveler');
    run.hp = 50;
    const relics = run.relics.length;
    choose(run, 'thaw');
    expect(run.hp).toBe(42);
    expect(run.relics).toHaveLength(relics + 1);
    run.hp = 8;
    atEvent(run, 'frozenTraveler');
    expect(eventOptionBlocked(run, option('frozenTraveler', 'thaw'), createGrimoire())).not.toBeNull();
  });
});

describe('the Wandering Alchemist', () => {
  it('trades a card for a different one', () => {
    const run = createRun(14);
    atEvent(run, 'wanderingAlchemist');
    const size = run.deck.length;
    const traded = run.deck[0]?.id;
    expect(choose(run, 'swap').next).toBe('pickCard');
    pickEventCard(run, 0, createGrimoire());
    expect(run.deck).toHaveLength(size);
    expect(run.deck[0]?.id).not.toBe(traded);
  });

  it('a lesson costs gold and teaches three recipes', () => {
    const run = createRun(15);
    atEvent(run, 'wanderingAlchemist');
    run.gold = 40;
    const grimoire = createGrimoire();
    choose(run, 'lesson', grimoire);
    expect(run.gold).toBe(10);
    expect(grimoire.discovered).toHaveLength(3);
    expect(currentEvent(run)).toBeUndefined();
  });
});

describe('the Old Observatory', () => {
  it('charting a new course adds a weather card for free', () => {
    const run = createRun(16);
    atEvent(run, 'oldObservatory');
    expect(choose(run, 'chart').next).toBe('pickSky');
    const [first] = eventSkyOptions(run);
    const gold = run.gold;
    pickEventSky(run, 0, createGrimoire());
    expect(run.sky.at(-1)).toBe(first);
    expect(run.gold).toBe(gold);
  });
});

describe('the Frozen Lake', () => {
  it('breaking the ice costs HP when you choose one of three rare cards', () => {
    const run = createRun(17);
    run.act = 2;
    atEvent(run, 'frozenLake');
    run.hp = 50;
    expect(choose(run, 'break').next).toBe('pickReward');
    const offered = eventCardOptions(run);
    expect(offered).toHaveLength(3);
    for (const id of offered) expect(RARE_POOL).toContain(id);
    expect(run.hp).toBe(50); // nothing is paid until you pick
    cancelEventPick(run);
    choose(run, 'break');
    expect(eventCardOptions(run)).toEqual(offered);
    const size = run.deck.length;
    const result = pickEventReward(run, 2, createGrimoire());
    expect(result.ok).toBe(true);
    expect(run.hp).toBe(43);
    expect(run.deck).toHaveLength(size + 1);
    expect(run.deck.at(-1)?.id).toBe(offered[2]);
    expect(run.event).toBeUndefined();
  });

  it('chilling a card infuses it with Frost', () => {
    const run = createRun(18);
    run.act = 2;
    atEvent(run, 'frozenLake');
    expect(choose(run, 'chill').next).toBe('pickCard');
    pickEventCard(run, 3, createGrimoire());
    expect(run.deck[3]?.infusion).toBe('frost');
  });
});

describe('the Lightning Forge', () => {
  it('melts down a card you pick', () => {
    const run = createRun(19);
    run.act = 2;
    atEvent(run, 'lightningForge');
    const size = run.deck.length;
    const second = run.deck[1];
    expect(choose(run, 'melt').next).toBe('pickCard');
    expect(pickEventCard(run, 0, createGrimoire()).ok).toBe(true);
    expect(run.deck).toHaveLength(size - 1);
    expect(run.deck[0]).toBe(second);
  });

  it("can't melt your last card", () => {
    const run = createRun(20);
    atEvent(run, 'lightningForge');
    run.deck = [{ id: 'strike' }];
    expect(eventOptionBlocked(run, option('lightningForge', 'melt'), createGrimoire())).toBe('Your deck is too small.');
  });

  it('working the bellows trades HP for gold', () => {
    const run = createRun(21);
    atEvent(run, 'lightningForge');
    run.hp = 40;
    const gold = run.gold;
    choose(run, 'bellows');
    expect(run.hp).toBe(34);
    expect(run.gold).toBe(gold + 60);
  });
});

describe('the Sky Merchant', () => {
  it('sells a rare card of your choice', () => {
    const run = createRun(22);
    atEvent(run, 'skyMerchant');
    run.gold = 50;
    expect(eventOptionBlocked(run, option('skyMerchant', 'rare'), createGrimoire())).toBe('Not enough gold.');
    run.gold = 100;
    choose(run, 'rare');
    pickEventReward(run, 0, createGrimoire());
    expect(run.gold).toBe(30);
    expect(RARE_POOL).toContain(run.deck.at(-1)?.id);
  });
});

describe('the Storm Altar', () => {
  it('trades max HP for a relic', () => {
    const run = createRun(23);
    atEvent(run, 'stormAltar');
    run.hp = run.maxHp;
    const { maxHp } = run;
    const relics = run.relics.length;
    expect(choose(run, 'offer').message).toContain('Max HP −8.');
    expect(run.maxHp).toBe(maxHp - 8);
    expect(run.hp).toBe(maxHp - 8);
    expect(run.relics).toHaveLength(relics + 1);
  });

  it('keeps your HP when you are already below the new max', () => {
    const run = createRun(24);
    atEvent(run, 'stormAltar');
    run.hp = 30;
    choose(run, 'offer');
    expect(run.hp).toBe(30);
  });
});
