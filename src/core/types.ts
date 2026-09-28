/** Shared game types. Everything here is plain data so it can be saved as JSON. */

export type Effect = { type: 'damage'; amount: number } | { type: 'block'; amount: number };

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
  block?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  /** Moves are used in order and repeat, so intents are predictable. */
  moves: EnemyMove[];
}

export interface Combatant {
  hp: number;
  maxHp: number;
  block: number;
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

export interface CombatState {
  player: PlayerState;
  enemies: EnemyState[];
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  turn: number;
  status: CombatStatus;
  rngState: number;
}

export type UnitRef = { side: 'player' } | { side: 'enemy'; index: number };

/** Things that happened, returned so the UI can animate them. */
export type CombatEvent =
  | { type: 'damage'; target: UnitRef; amount: number; blocked: number }
  | { type: 'block'; target: UnitRef; amount: number }
  | { type: 'enemyMove'; index: number; move: EnemyMove }
  | { type: 'shuffle' };
