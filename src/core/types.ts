/** Shared game types. Everything here is plain data so it can be saved as JSON. */

export type WeatherId = 'clear' | 'rain' | 'storm' | 'heatwave' | 'snow';

/** Elements tag damage so weather can modify it. No element means physical. */
export type ElementId = 'fire' | 'water' | 'earth' | 'air' | 'spark' | 'frost';

export type StatusId = 'burn' | 'weak';

/**
 * Effects are shared by cards and brews. `all` hits every enemy; otherwise
 * damage and statuses go to the chosen enemy.
 */
export type Effect =
  | { type: 'damage'; amount: number; element?: ElementId; all?: boolean }
  | { type: 'applyStatus'; status: StatusId; amount: number; all?: boolean }
  | { type: 'block'; amount: number }
  | { type: 'heal'; amount: number }
  | { type: 'energy'; amount: number }
  | { type: 'draw'; amount: number }
  | { type: 'setWeather'; weather: WeatherId }
  /** Swap the current weather with the next forecast weather. */
  | { type: 'swapForecast' }
  /** Restart the current weather's countdown. */
  | { type: 'holdWeather' }
  | { type: 'addElement'; element: ElementId }
  | { type: 'brew' }
  /** The next brew this fight is bottled as a potion instead of used. */
  | { type: 'bottle' };

export type CardKind = 'attack' | 'skill';

/** Who a card is played on: a chosen enemy, or the player (no target needed). */
export type CardTarget = 'enemy' | 'self';

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  kind: CardKind;
  target: CardTarget;
  effects: Effect[];
  /** Rules text. `{damage}` is replaced with the card's current damage. */
  text: string;
}

export interface RecipeDef {
  id: string;
  name: string;
  /** The elements it needs, in any order. */
  elements: ElementId[];
  effects: Effect[];
  /** Rules text. `{damage}` is replaced with the current damage. */
  text: string;
}

/** A card in the run's deck. An infused card also adds its element when played. */
export interface DeckCard {
  id: string;
  infusion?: ElementId;
}

/** A specific copy of a card in a fight. `uid` tells duplicate copies apart. */
export interface CardInstance {
  uid: number;
  defId: string;
  infusion?: ElementId;
}

export interface EnemyMove {
  name: string;
  damage?: number;
  element?: ElementId;
  block?: number;
  /** Changes the weather before attacking. */
  weather?: WeatherId;
  /** A status applied to the player after attacking. */
  status?: { status: StatusId; amount: number };
  /** Takes the newest element out of the player's cauldron. */
  stealElement?: boolean;
}

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  /** Moves are used in order and repeat, so intents are predictable. */
  moves: EnemyMove[];
  /** Weathers whose effects this enemy ignores ("Weathered"). */
  weathered?: WeatherId[];
  /** Once HP is at or below this fraction of max HP, these moves are used instead. */
  phase2?: { below: number; moves: EnemyMove[] };
}

export interface Combatant {
  hp: number;
  maxHp: number;
  block: number;
  statuses: Partial<Record<StatusId, number>>;
}

export interface PlayerState extends Combatant {
  energy: number;
  maxEnergy: number;
}

export interface EnemyState extends Combatant {
  defId: string;
  name: string;
  moveIndex: number;
}

export type CombatStatus = 'playing' | 'won' | 'lost';

export interface WeatherState {
  current: WeatherId;
  /** Upcoming scheduled weathers, soonest first. */
  forecast: WeatherId[];
  /** The turn on which the weather next changes to the forecast. */
  nextChangeTurn: number;
}

export interface CombatState {
  player: PlayerState;
  enemies: EnemyState[];
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  turn: number;
  weather: WeatherState;
  /** Elements waiting to be brewed, oldest first. */
  cauldron: ElementId[];
  cauldronSlots: number;
  relics: string[];
  /** Bottled brews (recipe ids) the player carries; used for free. */
  potions: string[];
  /** How many upcoming brews will be bottled instead of used. */
  bottleNext: number;
  status: CombatStatus;
  rngState: number;
}

export type UnitRef = { side: 'player' } | { side: 'enemy'; index: number };

/** Things that happened, returned so the UI can animate them. */
export type CombatEvent =
  | { type: 'damage'; target: UnitRef; amount: number; blocked: number; source?: 'burn' | 'lightning' }
  | { type: 'block'; target: UnitRef; amount: number }
  | { type: 'enemyMove'; index: number; move: EnemyMove }
  | { type: 'status'; target: UnitRef; status: StatusId; amount: number }
  | { type: 'weather'; from: WeatherId; to: WeatherId; cause: 'schedule' | 'player' | 'enemy' }
  | { type: 'element'; element: ElementId }
  | { type: 'brew'; recipeId: string; used: ElementId[]; weatherElement?: ElementId; bottled?: boolean }
  | { type: 'potion'; recipeId: string }
  | { type: 'heal'; amount: number }
  | { type: 'steal'; index: number; element: ElementId }
  | { type: 'relic'; relic: string }
  | { type: 'shuffle' };
