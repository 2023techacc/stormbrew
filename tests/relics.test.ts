import { describe, expect, it } from 'vitest';
import {
  BASE_ELEMENTS,
  cardNeedsTarget,
  createCombat,
  currentIntent,
  endTurn,
  inPhase2,
  playCard,
  setWeather,
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
    const events = endTurn(s);
    expect(events).toContainEqual({ type: 'steal', index: 0, element: 'fire' });
    expect(s.cauldron).toEqual(['earth']);
  });
});
