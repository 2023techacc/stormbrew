import { describe, expect, it } from 'vitest';
import { CAULDRON_SLOTS, WEATHER_ELEMENTS, findBrew, findRecipe, recipeKey } from '../src/core/brewing';
import {
  cannotPlayReason,
  cardNeedsTarget,
  createCombat,
  endTurn,
  playCard,
  previewCardBrew,
  type CombatSetup,
} from '../src/core/combat';
import type { CombatState, ElementId } from '../src/core/types';
import { getCard } from '../src/data/cards';
import { RECIPES } from '../src/data/recipes';

const BASE: ElementId[] = ['fire', 'water', 'earth', 'air'];

const newCombat = (deck: string[], overrides: Partial<CombatSetup> = {}): CombatState =>
  createCombat({
    seed: 1,
    deck,
    enemies: ['cinderImp'],
    playerHp: 50,
    playerMaxHp: 75,
    ...overrides,
  }).state;

/** Plays the first card in hand with this id. */
const play = (s: CombatState, defId: string, target?: number) => {
  const card = s.hand.find((c) => c.defId === defId);
  if (!card) throw new Error(`no ${defId} in hand`);
  const result = playCard(s, card.uid, target);
  if (!result.ok) throw new Error(result.reason);
  return result.events;
};

const imp = (s: CombatState) => {
  const enemy = s.enemies[0];
  if (!enemy) throw new Error('no enemy');
  return enemy;
};

describe('recipes', () => {
  it('do not care about element order', () => {
    expect(recipeKey(['water', 'fire'])).toBe(recipeKey(['fire', 'water']));
    expect(findRecipe(['water', 'fire'])?.id).toBe('steam');
    expect(findRecipe(['air', 'fire', 'fire'])?.id).toBe('heatHaze');
  });

  it('have a recipe for every pair of base elements', () => {
    for (const a of BASE) for (const b of BASE) expect(findRecipe([a, b]), `${a}+${b}`).toBeDefined();
  });

  it('have a recipe for every weather element with every base element', () => {
    for (const w of Object.values(WEATHER_ELEMENTS)) {
      if (!w) continue;
      for (const b of BASE) expect(findRecipe([w, b]), `${w}+${b}`).toBeDefined();
    }
  });

  it('are unique and fit in the cauldron', () => {
    const keys = RECIPES.map((r) => recipeKey(r.elements));
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of RECIPES) {
      expect(r.elements.length).toBeGreaterThanOrEqual(2);
      expect(r.elements.length).toBeLessThanOrEqual(CAULDRON_SLOTS);
    }
  });
});

describe('findBrew', () => {
  it('prefers the largest recipe', () => {
    const result = findBrew(['fire', 'air', 'fire']);
    expect(result.recipe.id).toBe('heatHaze');
    expect(result.usedSlots).toEqual([0, 1, 2]);
  });

  it('brews the oldest matching pair and keeps the rest', () => {
    const result = findBrew(['fire', 'water', 'earth']);
    expect(result.recipe.id).toBe('steam');
    expect(result.usedSlots).toEqual([0, 1]);
  });

  it('makes Sludge from a lone element in clear weather', () => {
    const result = findBrew(['fire']);
    expect(result.recipe.id).toBe('sludge');
    expect(result.usedSlots).toEqual([0]);
  });

  it('makes weather-element recipes from caught elements', () => {
    expect(findBrew(['spark', 'fire']).recipe.id).toBe('plasmaBolt');
    expect(findBrew(['water', 'air', 'spark']).recipe.id).toBe('thunderhead');
  });
});

describe('brewing in combat', () => {
  it('Gather cards add elements to the cauldron', () => {
    const s = newCombat(['gatherDew', 'gatherStone', 'defend', 'defend', 'defend']);
    play(s, 'gatherDew');
    play(s, 'gatherStone');
    expect(s.cauldron).toEqual(['water', 'earth']);
    expect(s.player.block).toBe(3 + 4);
  });

  it('Stir brews the cauldron', () => {
    const s = newCombat(['gatherStone', 'gatherStone', 'stir', 'defend', 'defend']);
    play(s, 'gatherStone');
    play(s, 'gatherStone');
    const events = play(s, 'stir');
    expect(events[0]).toEqual({ type: 'brew', recipeId: 'stoneskin', used: ['earth', 'earth'] });
    expect(s.cauldron).toEqual([]);
    expect(s.player.block).toBe(4 + 4 + 12);
  });

  it('Stir cannot be played with an empty cauldron', () => {
    const s = newCombat(['stir', 'defend', 'defend', 'defend', 'defend']);
    const stir = s.hand.find((c) => c.defId === 'stir');
    if (!stir) throw new Error('no stir');
    expect(cannotPlayReason(s, stir)).toBe('The cauldron is empty.');
  });

  it('the cauldron holds three elements without brewing', () => {
    const s = newCombat(['gatherEmber', 'gatherEmber', 'gatherGust', 'stir', 'defend']);
    play(s, 'gatherEmber', 0);
    play(s, 'gatherEmber', 0);
    const events = play(s, 'gatherGust');
    expect(events.some((e) => e.type === 'brew')).toBe(false);
    expect(s.cauldron).toEqual(['fire', 'fire', 'air']);
    play(s, 'stir'); // Heat Haze hits ALL enemies, so no target needed
    expect(s.cauldron).toEqual([]);
    expect(s.weather.current).toBe('heatwave');
    // 4 + 4 from the Gathers, then Heat Haze's 6 fire damage boosted by its own Heatwave to 7.
    expect(imp(s).hp).toBe(42 - 4 - 4 - 7);
  });

  it('adding to a full cauldron brews it first, then adds the new element', () => {
    const s = newCombat(['gatherStone', 'gatherStone', 'gatherDew', 'gatherGust', 'defend']);
    s.player.energy = 4;
    play(s, 'gatherStone');
    play(s, 'gatherStone');
    play(s, 'gatherDew');
    expect(s.cauldron).toEqual(['earth', 'earth', 'water']);
    expect(previewCardBrew(s, getCard('gatherGust'))?.recipe.id).toBe('stoneskin');
    const events = play(s, 'gatherGust');
    expect(events.find((e) => e.type === 'brew')).toEqual({ type: 'brew', recipeId: 'stoneskin', used: ['earth', 'earth'] });
    // Water was left over; Air goes in after the brew.
    expect(s.cauldron).toEqual(['water', 'air']);
  });

  it('elements stay in the cauldron between turns', () => {
    const s = newCombat(['gatherDew', 'defend', 'defend', 'defend', 'defend']);
    play(s, 'gatherDew');
    endTurn(s);
    expect(s.cauldron).toEqual(['water']);
  });

  it('a lone element makes Sludge', () => {
    const s = newCombat(['gatherDew', 'stir', 'defend', 'defend', 'defend']);
    play(s, 'gatherDew');
    const events = play(s, 'stir');
    expect(events[0]).toEqual({ type: 'brew', recipeId: 'sludge', used: ['water'] });
    expect(s.player.block).toBe(3 + 2);
  });

  it('Steam makes enemies Weak, reducing their attacks, and Weak wears off', () => {
    const s = newCombat(['gatherEmber', 'gatherDew', 'stir', 'defend', 'defend']);
    play(s, 'gatherEmber', 0);
    play(s, 'gatherDew');
    play(s, 'stir');
    expect(imp(s).statuses.weak).toBe(2);
    expect(s.player.block).toBe(3); // from Gather Dew
    const hp = s.player.hp;
    endTurn(s); // Claw: 7 × 0.75 = 5, minus 3 Block
    expect(hp - s.player.hp).toBe(2);
    expect(imp(s).statuses.weak).toBe(1);
  });

  it('Magma applies Burn that hurts the enemy at the end of its turn', () => {
    const s = newCombat(['gatherEmber', 'gatherStone', 'stir', 'defend', 'defend']);
    play(s, 'gatherEmber', 0);
    play(s, 'gatherStone');
    play(s, 'stir', 0);
    expect(imp(s).hp).toBe(42 - 4 - 7);
    expect(imp(s).statuses.burn).toBe(3);
    endTurn(s);
    expect(imp(s).hp).toBe(42 - 4 - 7 - 3);
    expect(imp(s).statuses.burn).toBe(2);
  });

  it('Rain Cloud changes the weather and restarts the countdown', () => {
    const s = newCombat(['gatherDew', 'gatherGust', 'stir', 'defend', 'defend']);
    play(s, 'gatherDew');
    play(s, 'gatherGust');
    play(s, 'stir');
    expect(s.weather.current).toBe('rain');
    expect(s.weather.nextChangeTurn).toBe(s.turn + 3);
  });

  it('healing never goes above max HP', () => {
    const s = newCombat(['gatherDew', 'gatherDew', 'stir', 'defend', 'defend'], { playerHp: 73 });
    play(s, 'gatherDew');
    play(s, 'gatherDew');
    play(s, 'stir');
    expect(s.player.hp).toBe(75);
  });
});

describe('brew previews and targeting', () => {
  it('previews what a card will brew', () => {
    const s = newCombat(['gatherEmber', 'gatherEmber', 'stir', 'defend', 'defend']);
    play(s, 'gatherEmber', 0);
    expect(previewCardBrew(s, getCard('stir'))?.recipe.id).toBe('sludge');
    play(s, 'gatherEmber', 0);
    expect(previewCardBrew(s, getCard('stir'))?.recipe.id).toBe('fireball');
    expect(previewCardBrew(s, getCard('defend'))).toBeNull();
  });

  it('a card needs a target when the brew it triggers hits one enemy', () => {
    const s = newCombat(['gatherEmber', 'gatherEmber', 'gatherStone', 'gatherStone', 'stir']);
    const stir = s.hand.find((c) => c.defId === 'stir');
    if (!stir) throw new Error('no stir');
    play(s, 'gatherStone');
    play(s, 'gatherStone');
    expect(cardNeedsTarget(s, stir)).toBe(false); // Stoneskin
    s.cauldron = ['fire', 'fire'];
    expect(cardNeedsTarget(s, stir)).toBe(true); // Fireball
    expect(playCard(s, stir.uid).ok).toBe(false);
    expect(playCard(s, stir.uid, 0).ok).toBe(true);
    expect(imp(s).hp).toBe(42 - 12);
  });
});
