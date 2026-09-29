import { describe, expect, it } from 'vitest';
import {
  BASE_ELEMENTS,
  BASIC_RECIPES,
  DEWCATCHER_BLOCK,
  UMBRELLA_BLOCK,
  cardNeedsTarget,
  createCombat,
  currentIntent,
  endTurn,
  inPhase2,
  playCard,
  setWeather,
  toggleExposure,
  type CombatSetup,
} from '../src/core/combat';
import type { CombatState, WeatherId } from '../src/core/types';
import { RELICS, RELIC_POOL } from '../src/data/relics';

const newCombat = (relics: string[], overrides: Partial<CombatSetup> = {}): CombatState =>
  createCombat({
    seed: 1,
    deck: ['defend', 'defend', 'defend', 'defend', 'defend'],
    enemies: ['trainingDummy'],
    playerHp: 75,
    playerMaxHp: 75,
    relics,
    ...overrides,
  }).state;

const lockWeather = (s: CombatState, weather: WeatherId) => {
  s.weather.current = weather;
  s.weather.forecast = s.weather.forecast.map(() => weather);
};

describe('relics', () => {
  it('every relic in the pool exists and the starter is not in it', () => {
    for (const id of RELIC_POOL) expect(RELICS[id]).toBeDefined();
    expect(RELIC_POOL).not.toContain('copperCauldron');
  });

  it('Copper Cauldron starts the fight with a base element', () => {
    const s = newCombat(['copperCauldron']);
    expect(s.cauldron).toHaveLength(1);
    expect(BASE_ELEMENTS).toContain(s.cauldron[0]);
    expect(newCombat([]).cauldron).toEqual([]);
  });

  it('Iron Cauldron gives a 4th slot', () => {
    const s = newCombat(['ironCauldron'], { deck: ['gatherStone', 'gatherStone', 'gatherStone', 'gatherStone', 'stir'] });
    s.player.energy = 10;
    for (let i = 0; i < 4; i++) {
      const card = s.hand.find((c) => c.defId === 'gatherStone');
      if (card) playCard(s, card.uid);
    }
    expect(s.cauldronSlots).toBe(4);
    expect(s.cauldron).toEqual(['earth', 'earth', 'earth', 'earth']);
  });

  it('Weathervane gives Block whenever the weather changes', () => {
    const s = newCombat(['weathervane']);
    setWeather(s, 'rain', 'player');
    expect(s.player.block).toBe(3);
    setWeather(s, 'rain', 'player'); // not a change
    expect(s.player.block).toBe(3);
  });

  it('Weathervane Block from a scheduled change lasts through that turn', () => {
    const s = newCombat(['weathervane']);
    endTurn(s);
    endTurn(s);
    endTurn(s); // turn 4: scheduled change
    expect(s.weather.current).not.toBe('clear');
    expect(s.player.block).toBe(3);
  });

  it('Rain Barrel gives 1 extra energy in Rain', () => {
    const s = newCombat(['rainBarrel']);
    lockWeather(s, 'rain');
    endTurn(s);
    expect(s.player.energy).toBe(4);
  });

  it('Snow Globe gives Block at the start of turns in Snow', () => {
    const s = newCombat(['snowGlobe']);
    lockWeather(s, 'snow');
    endTurn(s);
    expect(s.player.block).toBe(3);
  });

  it('Lightning Rod keeps Storm lightning off you', () => {
    const s = newCombat(['lightningRod'], { enemies: ['cinderImp'], playerHp: 500, playerMaxHp: 500 });
    for (let i = 0; i < 15; i++) {
      lockWeather(s, 'storm');
      const events = endTurn(s);
      const hitMe = events.some((e) => e.type === 'damage' && e.source === 'lightning' && e.target.side === 'player');
      expect(hitMe).toBe(false);
    }
  });

  it('Sun Stone keeps Heatwave Burn off you', () => {
    const s = newCombat(['sunStone']);
    lockWeather(s, 'heatwave');
    endTurn(s);
    expect(s.player.statuses.burn).toBeUndefined();
  });

  it('Alembic turns Sludge into a random basic brew', () => {
    const s = newCombat(['alembic'], { deck: ['stir', 'defend', 'defend', 'defend', 'defend'] });
    s.cauldron = ['water']; // alone, it would be Sludge
    const stir = s.hand.find((c) => c.defId === 'stir');
    if (!stir) throw new Error('no stir');
    const result = playCard(s, stir.uid, 0);
    if (!result.ok) throw new Error(result.reason);
    const brew = result.events.find((e) => e.type === 'brew');
    expect(brew?.type === 'brew' && BASIC_RECIPES.includes(brew.recipeId)).toBe(true);
    expect(result.events).toContainEqual({ type: 'relic', relic: 'alembic' });
    expect(s.cauldron).toEqual([]);
  });

  it('Umbrella gives Block at the start of your turn, under cover only', () => {
    const cover = newCombat(['umbrella']);
    toggleExposure(cover);
    endTurn(cover);
    expect(cover.player.block).toBe(UMBRELLA_BLOCK);
    const out = newCombat(['umbrella']);
    endTurn(out);
    expect(out.player.block).toBe(0);
  });

  it('Wind Chime draws a card whenever the weather changes', () => {
    const s = newCombat(['windChime'], { deck: Array<string>(8).fill('defend') });
    const hand = s.hand.length;
    setWeather(s, 'rain', 'player');
    expect(s.hand).toHaveLength(hand + 1);
    setWeather(s, 'rain', 'player'); // not a change
    expect(s.hand).toHaveLength(hand + 1);
  });

  it('Dewcatcher gives Block when the weather drops an element into your cauldron', () => {
    const s = newCombat(['dewcatcher']);
    lockWeather(s, 'rain');
    endTurn(s);
    expect(s.cauldron).toEqual(['water']);
    expect(s.player.block).toBe(DEWCATCHER_BLOCK);
  });

  it('Cloud Seed starts fights in a weather from your sky', () => {
    expect(newCombat(['cloudSeed'], { sky: ['rain'] }).weather.current).toBe('rain');
    // With a mixed sky, it never starts Clear skies when another weather is there.
    for (let seed = 0; seed < 10; seed++) {
      expect(newCombat(['cloudSeed'], { seed }).weather.current).not.toBe('clear');
    }
    expect(newCombat([]).weather.current).toBe('clear');
  });
});

describe('infused cards', () => {
  it('add their element when played', () => {
    const s = newCombat([], { deck: [{ id: 'strike', infusion: 'fire' }, 'defend', 'defend', 'defend', 'defend'] });
    const strike = s.hand.find((c) => c.defId === 'strike');
    if (!strike) throw new Error('no strike');
    expect(strike.infusion).toBe('fire');
    playCard(s, strike.uid, 0);
    expect(s.cauldron).toEqual(['fire']);
  });

  it('count toward brew previews and targeting', () => {
    const s = newCombat([], { deck: [{ id: 'defend', infusion: 'fire' }, 'defend', 'defend', 'defend', 'defend'] });
    s.cauldron = ['fire', 'fire', 'fire'];
    const infused = s.hand.find((c) => c.infusion === 'fire');
    const plain = s.hand.find((c) => !c.infusion);
    if (!infused || !plain) throw new Error('missing cards');
    // Adding to a full cauldron brews Fireball first, which needs a target.
    expect(cardNeedsTarget(s, infused)).toBe(true);
    expect(cardNeedsTarget(s, plain)).toBe(false);
  });
});

describe('the Eye of the Storm', () => {
  const boss = () =>
    newCombat([], { enemies: ['eyeOfTheStorm'], playerHp: 999, playerMaxHp: 999 });

  it('changes the weather every round in a fixed cycle', () => {
    const s = boss();
    const weathers: WeatherId[] = [];
    for (let i = 0; i < 4; i++) {
      endTurn(s);
      weathers.push(s.weather.current);
    }
    expect(weathers).toEqual(['rain', 'storm', 'heatwave', 'snow']);
  });

  it('below half HP it steals the newest element from the cauldron', () => {
    const s = boss();
    const eye = s.enemies[0];
    if (!eye) throw new Error('no boss');
    expect(inPhase2(eye)).toBe(false);
    eye.hp = 60;
    expect(inPhase2(eye)).toBe(true);
    eye.moveIndex = 0;
    expect(currentIntent(eye).name).toBe('Siphon');
    s.cauldron = ['earth', 'fire'];
    toggleExposure(s); // take cover, so the Storm it calls drops nothing into the cauldron
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'steal', index: 0, element: 'fire' });
    expect(s.cauldron).toEqual(['earth']);
  });
});
