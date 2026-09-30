import { REWARD_POOL, getCard } from '../data/cards';
import { getEvent, type EventDef, type EventOption, type EventOutcome } from '../data/events';
import { RECIPES } from '../data/recipes';
import { SKY_POOL } from '../data/sky';
import { listOf, t } from '../i18n';
import { cardName, elementName, recipeName, relicName, skyName } from '../i18n/content';
import { potionCapacity } from './combat';
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

/** Where an event goes after a choice: back to the map, to a pick, or into a fight. */
export type EventResult =
  | { ok: true; next: 'map' | 'pickCard' | 'pickSky' | 'fight'; message: string }
  | { ok: false; reason: string };

type Pick = Extract<EventOutcome, { type: 'infuse' | 'swapCard' | 'removeSky' | 'chooseSky' }>;

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
    if (o.type === 'gold' && o.amount < 0 && run.gold < -o.amount) return t('err.noGold');
    if (o.type === 'loseHp' && run.hp <= o.amount) return t('err.tooDangerous');
    if (o.type === 'potion' && run.potions.length >= potionCapacity(run.relics)) return t('err.beltFull');
    if (o.type === 'relic' && relicsLeft(run).length === 0) return t('err.allRelics');
    if (o.type === 'learn' && unknownRecipes(grimoire).length === 0) return t('err.allRecipes');
    if (o.type === 'infuse' && !run.deck.some(canInfuse)) return t('err.allInfused');
    if (o.type === 'swapCard' && run.deck.length <= 1) return t('err.deckSmall');
    if (o.type === 'removeSky' && run.sky.length <= MIN_SKY) return t('err.minSky', { n: MIN_SKY });
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
  if (!run.event || !option) return { ok: false, reason: t('err.choiceGone') };
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
        ? t('event.pickInfuse', { element: elementName(pick.element) })
        : pick.type === 'swapCard'
          ? t('event.pickTrade')
          : pick.type === 'removeSky'
            ? t('event.pickRemoveSky')
            : t('event.pickAddSky');
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
  if (!pick || !card || (pick.type !== 'infuse' && pick.type !== 'swapCard')) return { ok: false, reason: t('err.nothingToPick') };
  if (!canPickEventCard(run, deckIndex)) return { ok: false, reason: t('err.alreadyInfused') };
  const paid = payForPending(run, grimoire);
  const name = cardName(getCard(card.id));
  let message: string;
  if (pick.type === 'infuse') {
    infuseCard(run, deckIndex, pick.element, [pick.element]);
    message = t('event.infused', { card: name, element: elementName(pick.element) });
  } else {
    const replacement = withRng(run, (rng) => rng.pick(REWARD_POOL.filter((id) => id !== card.id)));
    run.deck[deckIndex] = { id: replacement };
    message = t('event.traded', { card: name, newCard: cardName(getCard(replacement)) });
  }
  delete run.event;
  return { ok: true, next: 'map', message: join(paid, message) };
}

/** Finishes a weather-card pick (remove one from the sky, or add an offered one). */
export function pickEventSky(run: RunState, index: number, grimoire: Grimoire): EventResult {
  const pick = pendingPick(run);
  const id = eventSkyOptions(run)[index];
  if (!pick || id === undefined) return { ok: false, reason: t('err.nothingToPick') };
  const paid = payForPending(run, grimoire);
  const name = skyName(id);
  if (pick.type === 'removeSky') run.sky.splice(index, 1);
  else run.sky.push(id);
  delete run.event;
  return {
    ok: true,
    next: 'map',
    message: join(paid, t(pick.type === 'removeSky' ? 'event.skyGone' : 'event.skyJoins', { name })),
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
        messages.push(t('event.healed', { n: heal(run, o.amount) }));
        break;
      case 'maxHp':
        run.maxHp += o.amount;
        run.hp += o.amount;
        messages.push(t('event.maxHp', { n: o.amount }));
        break;
      case 'gold':
        run.gold = Math.max(0, run.gold + o.amount);
        messages.push(o.amount >= 0 ? t('event.gainedGold', { n: o.amount }) : t('event.paidGold', { n: -o.amount }));
        break;
      case 'loseHp': {
        const lost = Math.min(o.amount, run.hp - 1);
        run.hp -= lost;
        messages.push(t('event.lostHp', { n: lost }));
        break;
      }
      case 'relic': {
        const relic = randomRelic(run);
        if (relic) {
          run.relics.push(relic);
          messages.push(t('event.foundRelic', { name: relicName(relic) }));
        }
        break;
      }
      case 'potion': {
        if (run.potions.length >= potionCapacity(run.relics)) break;
        const potion = withRng(run, (rng) => rng.pick(POTION_POOL));
        run.potions.push(potion);
        messages.push(t('event.bottled', { name: recipeName(potion) }));
        break;
      }
      case 'learn': {
        const learned = withRng(run, (rng) => rng.shuffle(unknownRecipes(grimoire)).slice(0, o.count));
        grimoire.discovered.push(...learned);
        if (learned.length) messages.push(t('event.learned', { names: listOf(learned.map(recipeName)) }));
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
