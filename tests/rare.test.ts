import { describe, expect, it } from 'vitest';
import {
  CONDUCTOR_DAMAGE,
  STEADY_HANDS_BLOCK,
  createCombat,
  endTurn,
  playCard,
  setWeather,
  toggleExposure,
  type CombatSetup,
} from '../src/core/combat';
import {
  RARE_CHANCE,
  SHOP_PRICES,
  availableNodes,
  createRun,
  enterNode,
  rewardChoices,
  type RunState,
} from '../src/core/run';
import { SAVE_VERSION, makeRunSave, parseRunSave } from '../src/core/save';
import type { CombatState } from '../src/core/types';
import { CARDS, RARE_POOL, REWARD_POOL } from '../src/data/cards';
import type { MapNode } from '../src/core/map';

const DUMMY_HP = 999;

/** A fight against training dummies, which never attack. */
const newCombat = (deck: string[], overrides: Partial<CombatSetup> = {}): CombatState =>
  createCombat({ seed: 1, deck, enemies: ['trainingDummy'], playerHp: 75, playerMaxHp: 75, ...overrides }).state;

/** Puts a copy of a card in hand, whatever the shuffle did. */
const toHand = (s: CombatState, defId: string) => {
  const card = [...s.hand, ...s.drawPile, ...s.discardPile].find((c) => c.defId === defId);
  if (!card) throw new Error(`no ${defId} in the fight`);
  s.drawPile = s.drawPile.filter((c) => c !== card);
  s.discardPile = s.discardPile.filter((c) => c !== card);
  if (!s.hand.includes(card)) s.hand.push(card);
  return card;
};

/** Plays a card (from anywhere in the fight), with energy to spare. */
const play = (s: CombatState, defId: string, target?: number) => {
  const card = toHand(s, defId);
  s.player.energy = Math.max(s.player.energy, 3);
  const result = playCard(s, card.uid, target);
  if (!result.ok) throw new Error(result.reason);
  return result.events;
};

const enemy = (s: CombatState, index = 0) => {
  const found = s.enemies[index];
  if (!found) throw new Error('no enemy');
  return found;
};

const filler = (n = 6) => Array<string>(n).fill('defend');

/** A number from a card's data, so balance changes don't break tests about rules. */
const amount = (cardId: string, type: 'damage' | 'applyStatus', attuned = false): number => {
  const def = CARDS[cardId];
  const effect = (attuned ? def?.attuned?.effects : def?.effects)?.find((e) => e.type === type);
  if (!effect || (effect.type !== 'damage' && effect.type !== 'applyStatus')) throw new Error(`${cardId} has no ${type}`);
  return effect.amount;
};

describe('new common cards', () => {
  it('Fan the Flames applies Burn and adds Air', () => {
    const s = newCombat(['fanTheFlames', ...filler()]);
    play(s, 'fanTheFlames', 0);
    expect(enemy(s).statuses.burn).toBe(amount('fanTheFlames', 'applyStatus'));
    expect(s.cauldron).toEqual(['air']);
  });

  it('Forked Lightning also hits every enemy in a Storm', () => {
    const s = newCombat(['forkedLightning', 'forkedLightning', ...filler()], { enemies: ['trainingDummy', 'trainingDummy'] });
    const hit = amount('forkedLightning', 'damage');
    const fork = amount('forkedLightning', 'damage', true);
    play(s, 'forkedLightning', 0);
    expect([enemy(s, 0).hp, enemy(s, 1).hp]).toEqual([DUMMY_HP - hit, DUMMY_HP]);
    s.weather.current = 'storm';
    play(s, 'forkedLightning', 0);
    expect([enemy(s, 0).hp, enemy(s, 1).hp]).toEqual([DUMMY_HP - hit * 2 - fork, DUMMY_HP - fork]);
  });

  it('Whisk brews and draws 2', () => {
    const s = newCombat(['whisk', ...filler(10)]);
    s.cauldron = ['earth', 'earth'];
    toHand(s, 'whisk');
    const hand = s.hand.length;
    play(s, 'whisk');
    expect(s.player.block).toBe(12); // Stoneskin
    expect(s.hand.length).toBe(hand - 1 + 2);
    expect(s.cauldron).toEqual([]);
  });

  it('Fog Bank blocks and changes the next weather', () => {
    const s = newCombat(['fogBank', ...filler()], { sky: ['rain', 'storm', 'heatwave', 'snow', 'clear'] });
    const events = play(s, 'fogBank');
    expect(s.player.block).toBe(7);
    expect(events).toContainEqual({ type: 'forecast' });
  });

  it('Snowdrift draws 2 in Snow', () => {
    const s = newCombat(['snowdrift', 'snowdrift', ...filler(10)]);
    toHand(s, 'snowdrift');
    const before = s.hand.length;
    play(s, 'snowdrift');
    expect(s.hand.length).toBe(before - 1);
    s.weather.current = 'snow';
    toHand(s, 'snowdrift');
    const inSnow = s.hand.length;
    play(s, 'snowdrift');
    expect(s.hand.length).toBe(inSnow - 1 + 2);
    expect(s.player.block).toBe(12);
  });

  it('Heat Shimmer hits every enemy, and Burns them all in a Heatwave', () => {
    const s = newCombat(['heatShimmer', ...filler()], { enemies: ['trainingDummy', 'trainingDummy'] });
    s.weather.current = 'heatwave';
    play(s, 'heatShimmer');
    for (const e of s.enemies) {
      expect(e.hp).toBe(DUMMY_HP - Math.floor(amount('heatShimmer', 'damage') * 1.25)); // fire, +25% in a Heatwave
      expect(e.statuses.burn).toBe(amount('heatShimmer', 'applyStatus', true));
    }
  });

  it('Hailstones hits three times', () => {
    const s = newCombat(['hailstones', ...filler()]);
    const events = play(s, 'hailstones', 0);
    expect(events.filter((e) => e.type === 'damage')).toHaveLength(3);
    expect(enemy(s).hp).toBe(DUMMY_HP - 9);
  });
});

describe('Lasting cards', () => {
  it('leave the fight when played, and their effect stays', () => {
    const s = newCombat(['conductor', ...filler()]);
    const events = play(s, 'conductor');
    expect(events).toContainEqual({ type: 'lasting', card: 'conductor' });
    expect(s.lasting.conductor).toBe(1);
    const everywhere = [...s.hand, ...s.drawPile, ...s.discardPile];
    expect(everywhere.some((c) => c.defId === 'conductor')).toBe(false);
  });

  it('the Conductor hits every enemy whenever the weather changes, more with each copy', () => {
    const s = newCombat(['conductor', 'conductor', ...filler()], { enemies: ['trainingDummy', 'trainingDummy'] });
    play(s, 'conductor');
    setWeather(s, 'rain', 'player');
    expect([enemy(s, 0).hp, enemy(s, 1).hp]).toEqual([DUMMY_HP - CONDUCTOR_DAMAGE, DUMMY_HP - CONDUCTOR_DAMAGE]);
    // Holding the same weather is not a change.
    setWeather(s, 'rain', 'player');
    expect(enemy(s, 0).hp).toBe(DUMMY_HP - CONDUCTOR_DAMAGE);
    play(s, 'conductor');
    setWeather(s, 'snow', 'player');
    expect(enemy(s, 0).hp).toBe(DUMMY_HP - CONDUCTOR_DAMAGE * 3);
  });

  it("the Conductor can win the fight when an enemy's own weather arrives", () => {
    // The Storm Caller calls a Storm on its first move.
    const s = newCombat(['conductor', ...filler()], { enemies: ['stormCaller'] });
    play(s, 'conductor');
    enemy(s).hp = CONDUCTOR_DAMAGE;
    const events = endTurn(s);
    expect(s.status).toBe('won');
    // It fell before it could attack.
    expect(events.some((e) => e.type === 'damage' && e.target.side === 'player')).toBe(false);
  });

  it('Steady Hands gives Block with every brew', () => {
    const s = newCombat(['steadyHands', 'stir', ...filler()]);
    play(s, 'steadyHands');
    s.cauldron = ['fire', 'fire'];
    play(s, 'stir', 0);
    expect(s.player.block).toBe(STEADY_HANDS_BLOCK);
    expect(enemy(s).hp).toBe(DUMMY_HP - 12); // the Fireball still happens
  });

  it('Sky Harvest catches the weather twice out in the open, and nothing under cover', () => {
    const s = newCombat(['skyHarvest', ...filler(12)], { startWeather: 'rain' });
    play(s, 'skyHarvest');
    s.cauldron = [];
    s.weather.nextChangeTurn = 99;
    endTurn(s);
    expect(s.cauldron).toEqual(['water', 'water']);
    s.cauldron = [];
    toggleExposure(s);
    endTurn(s);
    expect(s.cauldron).toEqual([]);
  });

  it('Sky Harvest spills what the cauldron has no room for', () => {
    const s = newCombat(['skyHarvest', ...filler(12)], { startWeather: 'rain' });
    play(s, 'skyHarvest');
    s.cauldron = ['fire', 'earth'];
    s.weather.nextChangeTurn = 99;
    const events = endTurn(s);
    expect(s.cauldron).toEqual(['fire', 'earth', 'water']);
    expect(events).toContainEqual({ type: 'spill', element: 'water' });
  });
});

describe('rare cards', () => {
  it('Perfect Brew brews once, working twice', () => {
    const s = newCombat(['perfectBrew', ...filler()]);
    s.cauldron = ['fire', 'fire'];
    play(s, 'perfectBrew', 0);
    expect(enemy(s).hp).toBe(DUMMY_HP - 24);
    expect(s.doubleNext).toBe(0);
  });

  it('Lightning Storm calls a Storm and hits every enemy', () => {
    const s = newCombat(['lightningStorm', ...filler()], { enemies: ['trainingDummy', 'trainingDummy'] });
    play(s, 'lightningStorm');
    expect(s.weather.current).toBe('storm');
    expect([enemy(s, 0).hp, enemy(s, 1).hp]).toEqual([DUMMY_HP - 10, DUMMY_HP - 10]);
  });

  it('Sunbreak clears the sky and gives energy', () => {
    const s = newCombat(['sunbreak', ...filler()], { startWeather: 'storm' });
    const card = toHand(s, 'sunbreak');
    s.player.energy = 2;
    expect(playCard(s, card.uid).ok).toBe(true);
    expect(s.weather.current).toBe('clear');
    expect(s.player.energy).toBe(3);
  });

  it('Hoarfrost doubles your Block, and Avalanche hits for it', () => {
    const s = newCombat(['hoarfrost', 'avalanche', ...filler()]);
    s.player.block = 9;
    play(s, 'hoarfrost');
    expect(s.player.block).toBe(18);
    play(s, 'avalanche', 0);
    expect(enemy(s).hp).toBe(DUMMY_HP - 18);
    expect(s.player.block).toBe(18);
  });

  it('Avalanche is weaker while you are Weak, and does nothing without Block', () => {
    const s = newCombat(['avalanche', 'avalanche', ...filler()]);
    const events = play(s, 'avalanche', 0);
    expect(events.find((e) => e.type === 'damage')).toMatchObject({ amount: 0 });
    s.player.block = 20;
    s.player.statuses.weak = 1;
    play(s, 'avalanche', 0);
    expect(enemy(s).hp).toBe(DUMMY_HP - 15);
  });
});

/** Adds a node of the given type next to the player's position and walks there. */
const placeAt = (run: RunState, type: MapNode['type']): MapNode => {
  if (run.nodeId === null) enterNode(run, availableNodes(run)[0]?.id ?? '');
  const node: MapNode = { id: `test-${type}`, floor: 5, lane: 0, type, next: [] };
  run.map.nodes[node.id] = node;
  run.map.nodes[run.nodeId ?? '']?.next.push(node.id);
  return enterNode(run, node.id);
};

describe('rarity', () => {
  it('rare cards are only in the rare pool', () => {
    expect(RARE_POOL.length).toBeGreaterThanOrEqual(8);
    for (const id of RARE_POOL) {
      expect(CARDS[id]?.rarity, id).toBe('rare');
      expect(REWARD_POOL).not.toContain(id);
    }
    for (const id of REWARD_POOL) expect(CARDS[id]?.rarity, id).toBeUndefined();
  });

  it('after an act boss, every card offered is rare', () => {
    const run = createRun(5);
    const choices = rewardChoices(run, ['fireball'], 'boss');
    expect(choices).toHaveLength(3);
    for (const id of choices) expect(RARE_POOL).toContain(id);
  });

  it('rare cards show up now and then, more after elites and in later acts', () => {
    const rareShare = (tier: 'fight' | 'elite', act: number) => {
      let rare = 0;
      let total = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const run = createRun(seed);
        run.act = act;
        for (const id of rewardChoices(run, [], tier)) {
          total++;
          if (RARE_POOL.includes(id)) rare++;
        }
      }
      return rare / total;
    };
    const fight1 = rareShare('fight', 1);
    expect(fight1).toBeGreaterThan(RARE_CHANCE.fight[0] / 2);
    expect(fight1).toBeLessThan(RARE_CHANCE.fight[0] * 2);
    expect(rareShare('fight', 3)).toBeGreaterThan(fight1);
    expect(rareShare('elite', 1)).toBeGreaterThan(fight1);
  });

  it('a card reward never offers the same card twice', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const run = createRun(seed);
      run.act = 3;
      const choices = rewardChoices(run, [], 'elite');
      expect(new Set(choices).size).toBe(choices.length);
    }
  });

  it('shops sell two common cards and one rare card, which costs more', () => {
    const run = createRun(8);
    placeAt(run, 'shop');
    const cards = run.shop?.cards ?? [];
    expect(cards).toHaveLength(3);
    const [first, second, rare] = cards;
    expect(REWARD_POOL).toContain(first?.id);
    expect(REWARD_POOL).toContain(second?.id);
    expect(RARE_POOL).toContain(rare?.id);
    expect(rare?.price).toBeGreaterThanOrEqual(SHOP_PRICES.rare[0]);
    expect(rare?.price).toBeLessThanOrEqual(SHOP_PRICES.rare[1]);
  });
});

describe('saves', () => {
  it('a fight saved before Lasting cards existed still loads', () => {
    const run = createRun(9);
    const combat = newCombat(['strike', ...filler()]);
    const old = JSON.parse(JSON.stringify(makeRunSave(run, { name: 'combat', label: 'Floor 1' }, combat))) as {
      version: number;
      combat: Partial<CombatState>;
    };
    old.version = 5;
    delete old.combat.lasting;
    const loaded = parseRunSave(JSON.stringify(old));
    expect(loaded?.version).toBe(SAVE_VERSION);
    expect(loaded?.combat?.lasting).toEqual({});
  });
});
