import { describe, expect, it } from 'vitest';
import { endTurn } from '../src/core/combat';
import {
  EASY_FIGHTS,
  PLAYER_MAX_HP,
  REWARD_CHOICES,
  VICTORY_HEAL,
  addCardToDeck,
  createRun,
  finishFight,
  rewardChoices,
  startFight,
} from '../src/core/run';
import { REWARD_POOL, STARTER_DECK } from '../src/data/cards';
import { ENCOUNTERS } from '../src/data/enemies';

const winFight = (run: ReturnType<typeof createRun>) => {
  const { state } = startFight(run);
  for (const enemy of state.enemies) enemy.hp = 0;
  state.status = 'won';
  return state;
};

describe('runs', () => {
  it('start with full HP and the starter deck', () => {
    const run = createRun(1);
    expect(run.hp).toBe(PLAYER_MAX_HP);
    expect(run.deck).toEqual(STARTER_DECK);
    expect(run.fightsWon).toBe(0);
  });

  it('are deterministic for the same seed', () => {
    const a = createRun(9);
    const b = createRun(9);
    expect(startFight(a).state).toEqual(startFight(b).state);
    expect(rewardChoices(a)).toEqual(rewardChoices(b));
  });

  it('use easy encounters first, then hard ones', () => {
    const run = createRun(2);
    const key = (enemies: string[]) => enemies.join(',');
    const easy = ENCOUNTERS.easy.map(key);
    const hard = ENCOUNTERS.hard.map(key);
    for (let i = 0; i < 6; i++) {
      const { state } = startFight(run);
      const encounter = key(state.enemies.map((e) => e.defId));
      expect(i < EASY_FIGHTS ? easy : hard).toContain(encounter);
      finishFight(run, winFight(run));
    }
  });

  it('carry HP over between fights and heal a little after a win', () => {
    const run = createRun(3);
    const { state } = startFight(run);
    expect(state.player.hp).toBe(PLAYER_MAX_HP);
    state.player.hp = 40;
    for (const enemy of state.enemies) enemy.hp = 0;
    state.status = 'won';
    expect(finishFight(run, state)).toBe(VICTORY_HEAL);
    expect(run.hp).toBe(40 + VICTORY_HEAL);
    expect(run.fightsWon).toBe(1);
    expect(startFight(run).state.player.hp).toBe(40 + VICTORY_HEAL);
  });

  it('never heal above max HP', () => {
    const run = createRun(4);
    expect(finishFight(run, winFight(run))).toBe(0);
    expect(run.hp).toBe(PLAYER_MAX_HP);
  });

  it('end with 0 HP when a fight is lost', () => {
    const run = createRun(5);
    const { state } = startFight(run);
    state.player.hp = 1;
    while (state.status === 'playing') endTurn(state);
    expect(state.status).toBe('lost');
    expect(finishFight(run, state)).toBe(0);
    expect(run.hp).toBe(0);
    expect(run.fightsWon).toBe(0);
  });

  it('offer distinct reward cards, and chosen cards join the deck for later fights', () => {
    const run = createRun(6);
    const choices = rewardChoices(run);
    expect(choices).toHaveLength(REWARD_CHOICES);
    expect(new Set(choices).size).toBe(REWARD_CHOICES);
    for (const id of choices) expect(REWARD_POOL).toContain(id);
    addCardToDeck(run, 'thunderclap');
    const { state } = startFight(run);
    const all = [...state.drawPile, ...state.hand, ...state.discardPile];
    expect(all.filter((c) => c.defId === 'thunderclap')).toHaveLength(1);
    expect(all).toHaveLength(STARTER_DECK.length + 1);
  });
});
