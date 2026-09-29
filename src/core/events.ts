import { REWARD_POOL, getCard } from '../data/cards';
import { getEvent, type EventDef, type EventOption, type EventOutcome } from '../data/events';
import { RECIPES, getRecipe } from '../data/recipes';
import { getRelic } from '../data/relics';
import { SKY_POOL, getSkyCard } from '../data/sky';
import { MAX_POTIONS } from './combat';
import { isKnown, type Grimoire } from './grimoire';
import {
  MIN_SKY,
  POTION_POOL,
  canInfuse,
  heal,
  infuseCard,
  randomRelic,
  relicsLeft,
  withRng,
  type RunState,
} from './run';
import type { ElementId } from './types';

/** Where an event goes after a choice: back to the map, to a pick, or into a fight. */
export type EventResult =
  | { ok: true; next: 'map' | 'pickCard' | 'pickSky' | 'fight'; message: string }
  | { ok: false; reason: string };

type Pick = Extract<EventOutcome, { type: 'infuse' | 'swapCard' | 'removeSky' | 'chooseSky' }>;

const ELEMENT_NAMES: Record<ElementId, string> = {
  fire: 'Fire',
  water: 'Water',
  earth: 'Earth',
  air: 'Air',
  spark: 'Spark',
  frost: 'Frost',
};

export function currentEvent(run: RunState): EventDef | undefined {
  return run.event ? getEvent(run.event.id) : undefined;
}

function isPick(outcome: EventOutcome): outcome is Pick {
  return ['infuse', 'swapCard', 'removeSky', 'chooseSky'].includes(outcome.type);
}

function unknownRecipes(grimoire: Grimoire): string[] {
  return RECIPES.filter((r) => !isKnown(grimoire, r.id)).map((r) => r.id);
}

/** Why an option can't be chosen right now, or null if it can. */
export function eventOptionBlocked(run: RunState, option: EventOption, grimoire: Grimoire): string | null {
  for (const o of option.outcomes) {
    if (o.type === 'gold' && o.amount < 0 && run.gold < -o.amount) return 'Not enough gold.';
    if (o.type === 'loseHp' && run.hp <= o.amount) return 'Too dangerous with your HP.';
    if (o.type === 'potion' && run.potions.length >= MAX_POTIONS) return 'Your potion belt is full.';
    if (o.type === 'relic' && relicsLeft(run).length === 0) return 'You have every relic.';
    if (o.type === 'learn' && unknownRecipes(grimoire).length === 0) return 'You know every recipe.';
    if (o.type === 'infuse' && !run.deck.some(canInfuse)) return 'Every card is infused.';
    if (o.type === 'swapCard' && run.deck.length <= 1) return 'Your deck is too small.';
    if (o.type === 'removeSky' && run.sky.length <= MIN_SKY) return `Your sky needs at least ${MIN_SKY} weathers.`;
  }
  return null;
}

/**
 * Chooses an option. Most happen right away; an option that needs a card or a
 * weather card picked waits for pickEventCard / pickEventSky (and costs nothing
 * until then), and an elite fight is started by the caller.
 */
export function chooseEventOption(run: RunState, optionId: string, grimoire: Grimoire): EventResult {
  const option = currentEvent(run)?.options.find((o) => o.id === optionId);
  if (!run.event || !option) return { ok: false, reason: 'That choice is gone.' };
  const blocked = eventOptionBlocked(run, option, grimoire);
  if (blocked) return { ok: false, reason: blocked };

  const pick = option.outcomes.find(isPick);
  if (pick) {
    run.event.pending = option.id;
    if (pick.type === 'chooseSky') {
      // Rolled once, so leaving the pick and coming back shows the same cards.
      run.event.skyChoices ??= withRng(run, (rng) => rng.shuffle(SKY_POOL).slice(0, pick.choices));
    }
    const prompt =
      pick.type === 'infuse'
        ? `Pick a card to infuse with ${ELEMENT_NAMES[pick.element]}.`
        : pick.type === 'swapCard'
          ? 'Pick a card to trade away.'
          : pick.type === 'removeSky'
            ? 'Pick a weather card to remove from your sky.'
            : 'Pick a weather card to add to your sky.';
    return { ok: true, next: pick.type === 'infuse' || pick.type === 'swapCard' ? 'pickCard' : 'pickSky', message: prompt };
  }
  if (option.outcomes.some((o) => o.type === 'eliteFight')) {
    run.event.fight = true;
    return { ok: true, next: 'fight', message: '' };
  }
  const message = applyOutcomes(run, option.outcomes, grimoire);
  delete run.event;
  return { ok: true, next: 'map', message };
}

/** The pick the event is waiting on, if any. */
export function pendingPick(run: RunState): Pick | undefined {
  const option = currentEvent(run)?.options.find((o) => o.id === run.event?.pending);
  return option?.outcomes.find(isPick);
}

/** Goes back from a pick to the event's choices. */
export function cancelEventPick(run: RunState): void {
  if (run.event) delete run.event.pending;
}

/** The weather cards the pending pick chooses from: your sky, or the offered cards. */
export function eventSkyOptions(run: RunState): string[] {
  const pick = pendingPick(run);
  if (pick?.type === 'removeSky') return run.sky;
  if (pick?.type === 'chooseSky') return run.event?.skyChoices ?? [];
  return [];
}

/** Whether this deck card can be picked for the pending pick. */
export function canPickEventCard(run: RunState, deckIndex: number): boolean {
  const card = run.deck[deckIndex];
  const pick = pendingPick(run);
  if (!card || !pick) return false;
  return pick.type === 'infuse' ? canInfuse(card) : pick.type === 'swapCard';
}

/** Finishes a card pick (infuse or trade). */
export function pickEventCard(run: RunState, deckIndex: number, grimoire: Grimoire): EventResult {
  const pick = pendingPick(run);
  const card = run.deck[deckIndex];
  if (!pick || !card || (pick.type !== 'infuse' && pick.type !== 'swapCard')) return { ok: false, reason: 'Nothing to pick.' };
  if (!canPickEventCard(run, deckIndex)) return { ok: false, reason: 'That card is already infused.' };
  const paid = payForPending(run, grimoire);
  const name = getCard(card.id).name;
  let message: string;
  if (pick.type === 'infuse') {
    infuseCard(run, deckIndex, pick.element, [pick.element]);
    message = `${name} is infused with ${ELEMENT_NAMES[pick.element]}.`;
  } else {
    const replacement = withRng(run, (rng) => rng.pick(REWARD_POOL.filter((id) => id !== card.id)));
    run.deck[deckIndex] = { id: replacement };
    message = `${name} became ${getCard(replacement).name}.`;
  }
  delete run.event;
  return { ok: true, next: 'map', message: join(paid, message) };
}

/** Finishes a weather-card pick (remove one from the sky, or add an offered one). */
export function pickEventSky(run: RunState, index: number, grimoire: Grimoire): EventResult {
  const pick = pendingPick(run);
  const id = eventSkyOptions(run)[index];
  if (!pick || id === undefined) return { ok: false, reason: 'Nothing to pick.' };
  const paid = payForPending(run, grimoire);
  const name = getSkyCard(id).name;
  if (pick.type === 'removeSky') run.sky.splice(index, 1);
  else run.sky.push(id);
  delete run.event;
  return {
    ok: true,
    next: 'map',
    message: join(paid, pick.type === 'removeSky' ? `${name} is gone from your sky.` : `${name} joins your sky.`),
  };
}

/** Applies the pending option's other outcomes (its price) when its pick is made. */
function payForPending(run: RunState, grimoire: Grimoire): string {
  const option = currentEvent(run)?.options.find((o) => o.id === run.event?.pending);
  return option ? applyOutcomes(run, option.outcomes.filter((o) => !isPick(o)), grimoire) : '';
}

function applyOutcomes(run: RunState, outcomes: readonly EventOutcome[], grimoire: Grimoire): string {
  const messages: string[] = [];
  for (const o of outcomes) {
    switch (o.type) {
      case 'heal':
        messages.push(`Healed ${heal(run, o.amount)} HP.`);
        break;
      case 'maxHp':
        run.maxHp += o.amount;
        run.hp += o.amount;
        messages.push(`Max HP +${o.amount}.`);
        break;
      case 'gold':
        run.gold = Math.max(0, run.gold + o.amount);
        messages.push(o.amount >= 0 ? `Gained ${o.amount} gold.` : `Paid ${-o.amount} gold.`);
        break;
      case 'loseHp': {
        const lost = Math.min(o.amount, run.hp - 1);
        run.hp -= lost;
        messages.push(`Lost ${lost} HP.`);
        break;
      }
      case 'relic': {
        const relic = randomRelic(run);
        if (relic) {
          run.relics.push(relic);
          messages.push(`Found the ${getRelic(relic).name}!`);
        }
        break;
      }
      case 'potion': {
        if (run.potions.length >= MAX_POTIONS) break;
        const potion = withRng(run, (rng) => rng.pick(POTION_POOL));
        run.potions.push(potion);
        messages.push(`Bottled a ${getRecipe(potion).name} potion.`);
        break;
      }
      case 'learn': {
        const learned = withRng(run, (rng) => rng.shuffle(unknownRecipes(grimoire)).slice(0, o.count));
        grimoire.discovered.push(...learned);
        if (learned.length) messages.push(`Learned ${learned.map((id) => getRecipe(id).name).join(' and ')}!`);
        break;
      }
      default:
        // Picks and fights are handled by their own functions.
        break;
    }
  }
  return messages.join(' ');
}

const join = (...parts: string[]) => parts.filter(Boolean).join(' ');
