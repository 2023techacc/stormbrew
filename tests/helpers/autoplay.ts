import { cannotPlayReason, endTurn, isAlive, playCard } from '../../src/core/combat';
import {
  canPickEventCard,
  chooseEventOption,
  currentEvent,
  eventOptionBlocked,
  eventSkyOptions,
  pickEventCard,
  pickEventSky,
} from '../../src/core/events';
import { createGrimoire, type Grimoire } from '../../src/core/grimoire';
import { Rng } from '../../src/core/rng';
import {
  addCardToDeck,
  availableNodes,
  createRun,
  enterNode,
  finishFight,
  rest,
  startFight,
  type RunState,
} from '../../src/core/run';
import type { CombatState } from '../../src/core/types';
import type { EventOption } from '../../src/data/events';

/** Plays a fight with a simple strategy: stir when there's something to brew, otherwise a random playable card. */
export function autoplayFight(state: CombatState, rng: Rng): void {
  for (let turn = 0; turn < 60 && state.status === 'playing'; turn++) {
    for (let i = 0; i < 12 && state.status === 'playing'; i++) {
      const playable = state.hand.filter((c) => cannotPlayReason(state, c) === null);
      if (playable.length === 0) break;
      const stir = state.cauldron.length >= 2 ? playable.find((c) => c.defId === 'stir') : undefined;
      const card = stir ?? rng.pick(playable);
      playCard(state, card.uid, state.enemies.findIndex(isAlive));
    }
    endTurn(state);
  }
}

export interface EventPolicy {
  choose: (options: EventOption[]) => EventOption;
  /** Picks a deck index from the ones allowed. */
  card: (indices: number[]) => number;
  /** Picks a weather card from the ones offered. */
  sky: (ids: string[]) => number;
}

export const randomEventPolicy = (rng: Rng): EventPolicy => ({
  choose: (options) => rng.pick(options),
  card: (indices) => rng.pick(indices),
  sky: (ids) => rng.int(0, ids.length - 1),
});

/** Plays the event the run is at. Returns true if it started a fight. */
export function playEvent(run: RunState, grimoire: Grimoire, policy: EventPolicy): boolean {
  const event = currentEvent(run);
  if (!event) return false;
  const options = event.options.filter((o) => eventOptionBlocked(run, o, grimoire) === null);
  const result = chooseEventOption(run, policy.choose(options).id, grimoire);
  if (!result.ok) return false;
  if (result.next === 'pickCard') {
    const indices = run.deck.flatMap((_, i) => (canPickEventCard(run, i) ? [i] : []));
    pickEventCard(run, policy.card(indices), grimoire);
  } else if (result.next === 'pickSky') {
    pickEventSky(run, policy.sky(eventSkyOptions(run)), grimoire);
  }
  return result.next === 'fight';
}

/** Plays a whole run: random paths, rests heal, shops are skipped, events and rewards are picked at random. */
export function autoplayRun(seed: number, options: { distill: boolean }): RunState {
  const run = createRun(seed);
  const rng = new Rng(seed * 7919 + 13);
  const grimoire = createGrimoire();
  for (let step = 0; step < 30 && run.status === 'playing'; step++) {
    const next = availableNodes(run);
    if (next.length === 0) break;
    const node = enterNode(run, rng.pick(next).id);
    if (node.type === 'rest') rest(run);
    if (node.type === 'rest' || node.type === 'shop') continue;
    if (node.type === 'event' && !playEvent(run, grimoire, randomEventPolicy(rng))) continue;
    const { state } = startFight(run);
    autoplayFight(state, rng);
    const rewards = finishFight(run, state, { distill: options.distill });
    if (run.status === 'playing' && rewards.cardChoices.length) addCardToDeck(run, rng.pick(rewards.cardChoices));
  }
  return run;
}
