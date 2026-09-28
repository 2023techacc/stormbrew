import { cannotPlayReason, endTurn, isAlive, playCard } from '../../src/core/combat';
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

/** Plays a whole run: random paths, rests heal, shops are skipped, rewards are picked at random. */
export function autoplayRun(seed: number, options: { distill: boolean }): RunState {
  const run = createRun(seed);
  const rng = new Rng(seed * 7919 + 13);
  for (let step = 0; step < 30 && run.status === 'playing'; step++) {
    const next = availableNodes(run);
    if (next.length === 0) break;
    const node = enterNode(run, rng.pick(next).id);
    if (node.type === 'rest') rest(run);
    if (node.type === 'rest' || node.type === 'shop') continue;
    const { state } = startFight(run);
    autoplayFight(state, rng);
    const rewards = finishFight(run, state, { distill: options.distill });
    if (run.status === 'playing' && rewards.cardChoices.length) addCardToDeck(run, rng.pick(rewards.cardChoices));
  }
  return run;
}
