import type { ElementId } from '../core/types';

/**
 * Events: story spots on the map (❓) where you choose what to do. Most choices
 * happen right away; some ask you to pick a card or a weather card first, and
 * one starts a fight. The rules for each outcome live in core/events.ts.
 */
export type EventOutcome =
  | { type: 'heal'; amount: number }
  /** Negative amounts lower max HP (a price). */
  | { type: 'maxHp'; amount: number }
  /** Negative amounts are a price. */
  | { type: 'gold'; amount: number }
  | { type: 'loseHp'; amount: number }
  | { type: 'relic' }
  | { type: 'potion' }
  /** Learn recipes you have not discovered yet (kept in the Grimoire). */
  | { type: 'learn'; count: number }
  /** Pick a card to infuse with this element. */
  | { type: 'infuse'; element: ElementId }
  /** Pick a card to remove; a random card takes its place. */
  | { type: 'swapCard' }
  /** Pick a card to remove from the deck. */
  | { type: 'removeCard' }
  /** Choose one of this many rare cards to add to the deck. */
  | { type: 'rareCard'; choices: number }
  /** Pick a weather card to remove from your sky. */
  | { type: 'removeSky' }
  /** Pick one of this many weather cards to add to your sky. */
  | { type: 'chooseSky'; choices: number }
  /** Fight an elite, with an elite's rewards. */
  | { type: 'eliteFight' };

export interface EventOption {
  id: string;
  label: string;
  /** What happens, shown under the label. */
  text: string;
  outcomes: EventOutcome[];
}

export interface EventDef {
  id: string;
  name: string;
  text: string;
  options: EventOption[];
  /** The acts the event can happen in (every act if not set). */
  acts?: number[];
}

const leave = (text = 'Nothing happens.'): EventOption => ({ id: 'leave', label: 'Leave', text, outcomes: [] });

export const EVENTS: Record<string, EventDef> = {
  abandonedCauldron: {
    id: 'abandonedCauldron',
    name: 'Abandoned Cauldron',
    text: "A cauldron still bubbles over a dying fire. Whoever left it isn't coming back.",
    options: [
      { id: 'drink', label: 'Drink it', text: 'Heal 15 HP.', outcomes: [{ type: 'heal', amount: 15 }] },
      {
        id: 'study',
        label: 'Study the residue',
        text: "Learn 2 recipes you haven't discovered.",
        outcomes: [{ type: 'learn', count: 2 }],
      },
      { id: 'bottle', label: 'Bottle it', text: 'Gain a random potion.', outcomes: [{ type: 'potion' }] },
    ],
  },
  struckOak: {
    id: 'struckOak',
    name: 'Lightning-Struck Oak',
    text: 'An old oak, split down the middle by lightning, still crackles with power.',
    options: [
      {
        id: 'carve',
        label: 'Carve a charm',
        text: 'Infuse a card with ⚡: playing it also adds Spark.',
        outcomes: [{ type: 'infuse', element: 'spark' }],
      },
      { id: 'heartwood', label: 'Take the heartwood', text: 'Gain 5 Max HP.', outcomes: [{ type: 'maxHp', amount: 5 }] },
      leave(),
    ],
  },
  weatherShrine: {
    id: 'weatherShrine',
    name: 'Weather Shrine',
    text: 'Wind chimes ring over a mossy shrine to the sky. Offerings of every kind lie on its altar.',
    options: [
      {
        id: 'calm',
        label: 'Pray for calm',
        text: 'Remove a weather card from your sky.',
        outcomes: [{ type: 'removeSky' }],
      },
      {
        id: 'offer',
        label: 'Leave an offering (25 gold)',
        text: 'Choose 1 of 3 weather cards to add to your sky.',
        outcomes: [
          { type: 'gold', amount: -25 },
          { type: 'chooseSky', choices: 3 },
        ],
      },
      leave(),
    ],
  },
  stormChaser: {
    id: 'stormChaser',
    name: 'Storm Chaser',
    text: 'A storm chaser with a battered barometer waves you over. "A big one\'s coming. Want in?"',
    options: [
      {
        id: 'chase',
        label: 'Chase the storm',
        text: 'Fight an elite. Win a relic.',
        outcomes: [{ type: 'eliteFight' }],
      },
      {
        id: 'buy',
        label: 'Buy their gear (80 gold)',
        text: 'Gain a random relic.',
        outcomes: [{ type: 'gold', amount: -80 }, { type: 'relic' }],
      },
      leave(),
    ],
  },
  frozenTraveler: {
    id: 'frozenTraveler',
    name: 'Frozen Traveler',
    text: 'A traveler is frozen solid in a block of ice, their pack still on their back.',
    options: [
      {
        id: 'thaw',
        label: 'Thaw them (lose 8 HP)',
        text: 'They thank you with a relic.',
        outcomes: [{ type: 'loseHp', amount: 8 }, { type: 'relic' }],
      },
      { id: 'loot', label: 'Take the pack', text: 'Gain 45 gold.', outcomes: [{ type: 'gold', amount: 45 }] },
      leave('You walk on.'),
    ],
  },
  wanderingAlchemist: {
    id: 'wanderingAlchemist',
    name: 'Wandering Alchemist',
    text: 'An alchemist with a cart full of clinking bottles offers to trade.',
    options: [
      {
        id: 'swap',
        label: 'Trade a card',
        text: 'Remove a card from your deck. A random card takes its place.',
        outcomes: [{ type: 'swapCard' }],
      },
      {
        id: 'lesson',
        label: 'Buy a lesson (30 gold)',
        text: "Learn 3 recipes you haven't discovered.",
        outcomes: [
          { type: 'gold', amount: -30 },
          { type: 'learn', count: 3 },
        ],
      },
      leave(),
    ],
  },

  // Milestone 10: events for the later acts.
  oldObservatory: {
    id: 'oldObservatory',
    name: 'Old Observatory',
    text: 'A crumbling observatory. Its great telescope still points at the clouds.',
    options: [
      {
        id: 'study',
        label: 'Study the sky',
        text: "Learn 3 recipes you haven't discovered.",
        outcomes: [{ type: 'learn', count: 3 }],
      },
      {
        id: 'chart',
        label: 'Chart a new course',
        text: 'Choose 1 of 3 weather cards to add to your sky.',
        outcomes: [{ type: 'chooseSky', choices: 3 }],
      },
      leave(),
    ],
  },
  frozenLake: {
    id: 'frozenLake',
    name: 'Frozen Lake',
    text: 'A frozen lake stretches to the mountains. Something glints deep under the ice.',
    acts: [2],
    options: [
      {
        id: 'break',
        label: 'Break the ice (lose 7 HP)',
        text: 'Choose 1 of 3 rare cards.',
        outcomes: [
          { type: 'loseHp', amount: 7 },
          { type: 'rareCard', choices: 3 },
        ],
      },
      {
        id: 'chill',
        label: 'Chill a card in the ice',
        text: 'Infuse a card with ❄️: playing it also adds Frost.',
        outcomes: [{ type: 'infuse', element: 'frost' }],
      },
      leave(),
    ],
  },
  lightningForge: {
    id: 'lightningForge',
    name: 'Lightning Forge',
    text: 'A forge burns with captured lightning. Its smith offers to rework your gear.',
    acts: [2, 3],
    options: [
      {
        id: 'melt',
        label: 'Melt down a card',
        text: 'Remove a card from your deck.',
        outcomes: [{ type: 'removeCard' }],
      },
      {
        id: 'bellows',
        label: 'Work the bellows (lose 6 HP)',
        text: 'Gain 60 gold.',
        outcomes: [
          { type: 'loseHp', amount: 6 },
          { type: 'gold', amount: 60 },
        ],
      },
      leave(),
    ],
  },
  skyMerchant: {
    id: 'skyMerchant',
    name: 'Sky Merchant',
    text: 'An airship is moored to the cliff. Its merchant sells rare things to those who can pay.',
    acts: [2, 3],
    options: [
      {
        id: 'rare',
        label: 'Buy a rare card (70 gold)',
        text: 'Choose 1 of 3 rare cards.',
        outcomes: [
          { type: 'gold', amount: -70 },
          { type: 'rareCard', choices: 3 },
        ],
      },
      {
        id: 'potion',
        label: 'Buy a potion (20 gold)',
        text: 'Gain a random potion.',
        outcomes: [{ type: 'gold', amount: -20 }, { type: 'potion' }],
      },
      leave(),
    ],
  },
  stormAltar: {
    id: 'stormAltar',
    name: 'Storm Altar',
    text: 'At the top of the citadel stands an altar, crackling with the power of the storm.',
    acts: [3],
    options: [
      {
        id: 'offer',
        label: 'Offer your strength (lose 8 max HP)',
        text: 'Gain a random relic.',
        outcomes: [{ type: 'maxHp', amount: -8 }, { type: 'relic' }],
      },
      { id: 'pray', label: 'Pray for calm', text: 'Heal 25 HP.', outcomes: [{ type: 'heal', amount: 25 }] },
      leave(),
    ],
  },
};

export const EVENT_IDS = Object.keys(EVENTS);

/** Whether an event can happen in this act. */
export function eventInAct(id: string, act: number): boolean {
  const acts = EVENTS[id]?.acts;
  return !acts || acts.includes(act);
}

export function getEvent(id: string): EventDef {
  const event = EVENTS[id];
  if (!event) throw new Error(`Unknown event: ${id}`);
  return event;
}
