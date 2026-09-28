/** Shared game types. Everything here is plain data so it can be saved as JSON. */

export type WeatherId = 'clear' | 'rain' | 'storm' | 'heatwave' | 'snow';

/** Elements tag damage so weather can modify it. No element means physical. */
export type ElementId = 'fire' | 'water' | 'earth' | 'air' | 'spark' | 'frost';

export type StatusId = 'burn';

export type Effect =
  | { type: 'damage'; amount: number; element?: ElementId }
  | { type: 'block'; amount: number }
  | { type: 'draw'; amount: number }
  | { type: 'setWeather'; weather: WeatherId };

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

/** A specific copy of a card in a deck. `uid` tells duplicate copies apart. */
export interface CardInstance {
  uid: number;
  defId: string;
}

export interface EnemyMove {
  name: string;
  damage?: number;
  element?: ElementId;
  block?: number;
  /** Changes the weather before attacking. */
  weather?: WeatherId;
}

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  /** Moves are used in order and repeat, so intents are predictable. */
  moves: EnemyMove[];
  /** Weathers whose effects this enemy ignores ("Weathered"). */
  weathered?: WeatherId[];
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
  | { type: 'shuffle' };
