/** Shared game types. Everything here is plain data so it can be saved as JSON. */

export type WeatherId = 'clear' | 'rain' | 'storm' | 'heatwave' | 'snow';

/** Elements tag damage so weather can modify it. No element means physical. */
export type ElementId = 'fire' | 'water' | 'earth' | 'air' | 'spark' | 'frost';

export type StatusId = 'burn' | 'weak';

/** Lasting cards: their effect stays for the rest of the fight (see core/combat.ts). */
export type LastingId = 'conductor' | 'steadyHands' | 'skyHarvest';

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
  /** Replace the next forecast weather with a new one from the sky. */
  | { type: 'scatter' }
  /** The next forecast weather arrives now. */
  | { type: 'advanceWeather' }
  | { type: 'addElement'; element: ElementId }
  /** Add the current weather's element (nothing in Clear). */
  | { type: 'catchWeather' }
  | { type: 'brew' }
  /** The next brew this fight works twice. */
  | { type: 'doubleBrew' }
  /** Empty the cauldron and deal this much damage to the target for each element in it. */
  | { type: 'boilOver'; amount: number }
  /** The next brew this fight is bottled as a potion instead of used. */
  | { type: 'bottle' }
  /** Take the newest element from the target enemy's cauldron into yours. */
  | { type: 'steal' }
  /** The target enemy's next brew fails (becomes Sludge). */
  | { type: 'spoil' }
  /** Stays for the rest of the fight (the card is a Lasting card). */
  | { type: 'lasting'; card: LastingId }
  /** Doubles the player's Block. */
  | { type: 'doubleBlock' }
  /** Deals damage equal to the player's Block to the target. */
  | { type: 'blockDamage' };

/** Lasting cards ('power') leave the fight when played; their effect stays. */
export type CardKind = 'attack' | 'skill' | 'power';

/** Who a card is played on: a chosen enemy, or the player (no target needed). */
export type CardTarget = 'enemy' | 'self';

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  kind: CardKind;
  target: CardTarget;
  effects: Effect[];
  /** Attuned: extra effects when the card is played in this weather. */
  attuned?: { weather: WeatherId; effects: Effect[] };
  /** Rare cards are offered less often (see core/run.ts); other cards are common. */
  rarity?: 'rare';
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
  /** Shorter text for the recipe's distilled card, when `text` is too long for a card. */
  cardText?: string;
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
  /** The attack hits this many times (each hit is `damage`); 1 if not set. */
  hits?: number;
  element?: ElementId;
  block?: number;
  /** The enemy heals itself this much. */
  heal?: number;
  /** Breaks all the player's Block before the attack lands. */
  shatter?: boolean;
  /** Changes the weather before attacking. */
  weather?: WeatherId;
  /** A status applied to the player after attacking. */
  status?: { status: StatusId; amount: number };
  /** Takes the newest element out of the player's cauldron. */
  stealElement?: boolean;
  /** Shuffles these sky cards into the player's sky for this fight. */
  addSky?: string[];
  /** Extra damage when the player is out in the open (hunters strike from the sky). */
  exposedBonus?: number;
  /** Extra damage or Block when the move is made in this weather. */
  attuned?: { weather: WeatherId; damage?: number; block?: number };
}

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  /** Moves are used in order and repeat, so intents are predictable. */
  moves: EnemyMove[];
  /** Weathers whose effects this enemy ignores ("Weathered"). */
  weathered?: WeatherId[];
  /** Always under cover, so the weather's harm never reaches it. */
  sheltered?: boolean;
  /** Once HP is at or below this fraction of max HP, these moves are used instead. */
  phase2?: { below: number; moves: EnemyMove[] };
  /**
   * Enemies that brew: after each move they add the next element from
   * `gathers` (in order, repeating) and brew when the cauldron holds `size`.
   * Elements they steal from the player also go in.
   */
  cauldron?: { size: number; gathers: ElementId[] };
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
  /**
   * Out in the open (true) or under cover. Out, you catch the weather's element
   * each turn but its harm (lightning, Heatwave Burn) can reach you.
   */
  exposed: boolean;
}

export interface EnemyState extends Combatant {
  defId: string;
  name: string;
  moveIndex: number;
  /** The enemy's own cauldron (empty for enemies that don't brew). */
  cauldron: ElementId[];
  gatherIndex: number;
  /** Its next brew fails. */
  spoiled: boolean;
}

export type CombatStatus = 'playing' | 'won' | 'lost';

export interface WeatherState {
  current: WeatherId;
  /** The sky card the current weather came from (e.g. 'monsoon'). */
  currentCard: string;
  /** Upcoming sky cards, soonest first. A basic card's id is its weather's id. */
  forecast: string[];
  /** The turn on which the weather next changes to the forecast. */
  nextChangeTurn: number;
  /** Sky cards still to be drawn this fight. */
  skyPile: string[];
  /** Every sky card in this fight (the run's sky deck plus any added by enemies); reshuffled when the pile runs out. */
  skyDeck: string[];
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
  /** How many upcoming brews will work twice. */
  doubleNext: number;
  /** Recipes brewed this fight, by the player or enemies (no Sludge); they can be distilled afterwards. */
  brewed: string[];
  /** Lasting cards played this fight, and how many copies of each. */
  lasting: Partial<Record<LastingId, number>>;
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
  /** An element went into the cauldron (from a card, or caught from the weather). */
  | { type: 'element'; element: ElementId; fromWeather?: boolean }
  /** A weather element was lost because the cauldron was full. */
  | { type: 'spill'; element: ElementId }
  | { type: 'exposure'; exposed: boolean }
  /** The forecast changed without the weather changing. */
  | { type: 'forecast' }
  | { type: 'skyAdded'; index: number; cards: string[] }
  | { type: 'brew'; recipeId: string; used: ElementId[]; bottled?: boolean }
  | { type: 'potion'; recipeId: string }
  | { type: 'heal'; amount: number }
  /** An enemy took an element from the player's cauldron. */
  | { type: 'steal'; index: number; element: ElementId }
  /** The player took an element from an enemy's cauldron. */
  | { type: 'pilfer'; index: number; element: ElementId; kept: boolean }
  | { type: 'spoiled'; index: number }
  | { type: 'enemyGather'; index: number; element: ElementId }
  | { type: 'enemyBrew'; index: number; recipeId: string; used: ElementId[] }
  /** An enemy healed itself. */
  | { type: 'enemyHeal'; index: number; amount: number }
  /** An enemy broke all of the player's Block. */
  | { type: 'shatter'; amount: number }
  | { type: 'relic'; relic: string }
  /** A Lasting card was played: it stays for the rest of the fight. */
  | { type: 'lasting'; card: LastingId }
  /** A Lasting card's effect happened. */
  | { type: 'lastingEffect'; card: LastingId }
  | { type: 'shuffle' };
