# Stormbrew — Game Plan

> A roguelike deck-builder in the spirit of *Slay the Spire*, built around two
> interlocking systems: **Weather**, which shifts the rules of every fight, and
> **Brewing**, where you combine elements into powerful effects.

---

## 1. Vision

You are a **Stormbrewer**, an alchemist who climbs a storm-wracked mountain.
Every fight takes place under a changing sky, and your main weapon is a cauldron.
Cards add **elements** to the cauldron, and brewing them together sets off
effects that depend on the combination. Weather makes some brews stronger and
others weaker, and many brews change the weather themselves.

**Design pillars**

1. **The sky is a shared resource.** Weather affects the player *and* the
   enemies. Changing it at the right moment should feel like a big play.
2. **Brewing rewards experimentation.** Combinations are discovered, recorded in
   a Grimoire, and stay learned between runs.
3. **Readable, not random.** A visible forecast shows upcoming weather and enemy
   intents are shown, so the player can plan ahead the way they do in *Slay the
   Spire*.

---

## 2. Core Loop

```
Start run → Map (choose path) → Node
   ├─ Combat / Elite / Boss → Rewards (card, gold, ingredients, relic)
   ├─ Cauldron site (brew potions out of combat)
   ├─ Rest site (heal or upgrade a card)
   ├─ Shop (cards, relics, ingredients, card removal)
   └─ Event (story choice, often weather-related)
→ Defeat the act boss → next act (3 acts total) → Final boss
```

### Combat basics (inherited from the genre)
- 3 **energy** per turn, draw 5 cards, discard your hand at end of turn.
- Card types: **Attack**, **Skill**, **Power**, plus new types
  **Element** (adds elements to the cauldron) and **Brew** (brews the cauldron's contents).
- Enemies show their **intent** for the coming turn.
- Block goes away at the start of your turn, as in *Slay the Spire*.

---

## 3. Weather System

### 3.1 Weather states (MVP: 5, later up to 8)

| Weather    | Global effect (everyone)                                  | Brewing interaction                  |
|------------|-----------------------------------------------------------|--------------------------------------|
| **Clear**  | No modifiers. The baseline.                                | —                                    |
| **Rain**   | Fire damage −25%. Water effects +1.                       | Water elements count double          |
| **Storm**  | End of each round: a lightning bolt hits a random unit for 5. | Adds a free **Spark** to every brew  |
| **Heatwave** | Everyone gains 1 Burn per turn. Fire damage +25%.       | Water elements evaporate (removed) after 1 turn |
| **Snow**   | Block is **not** removed at turn start (both sides).       | Adds a free **Frost** to every brew  |
| *Later:* **Fog** | Intents hidden; 20% miss chance on attacks.         | Brew results hidden until resolved   |
| *Later:* **Gale** | Top card of draw pile discarded each turn; Air +1. | Air elements count double            |
| *Later:* **Eclipse** (rare) | All brews are “inverted” (buffs ↔ debuffs). | —                                    |

### 3.2 How weather changes
1. **Natural cycle**: weather changes every **3 rounds** by default. The
   **Forecast** bar shows the current weather and the next one or two, which works
   like intents for the sky.
2. **Player**: cards (*Summon Rain*, *Clear Skies*), brews (Water + Air → *Rain
   Cloud*), potions, relics.
3. **Enemies**: some enemies call weather as their intent (e.g. *Storm Caller*:
   “Next turn: Storm”).
4. **Other sources**: map events, act themes (Act 2 leans toward Snow and Storm),
   boss phases.

Manually setting weather **resets the 3-round timer**. That means the player can
hold a good weather state by recasting it, or push out a bad one early.

### 3.3 Weather-related keywords
- **Attuned (X)**: this card has a bonus effect while the weather is X.
- **Forecast**: look at or change an upcoming weather slot.
- **Weathered**: an enemy that is immune to the current weather's effect.

---

## 4. Brewing System

### 4.1 Elements
- **Base elements** (from cards): 🔥 Ember (Fire), 💧 Dew (Water), 🪨 Stone (Earth), 🌬️ Gust (Air)
- **Weather-born elements** (only gained through weather, relics, or rare cards):
  ⚡ Spark, ❄️ Frost, ☀️ Sunlight, 🌫️ Mist

### 4.2 The Cauldron
- Has **3 slots** by default. Relics can increase this to 4 or 5.
- **Element** cards add elements to empty slots.
- Playing a **Brew** card, or filling the last slot, **brews**: the contents are
  matched against the recipe table and the result fires right away.
- Order does **not** matter in the MVP; recipes are matched as unordered sets.
  Order-sensitive “advanced recipes” can be added later.
- Contents that match no recipe produce **Sludge**: a weak random effect, or a
  *Sludge* curse card goes into your discard pile.

### 4.3 Starter recipe table (examples)

| Combination             | Result           | Effect                                                |
|-------------------------|------------------|-------------------------------------------------------|
| Fire + Fire             | **Fireball**     | Deal 12 damage                                         |
| Water + Water           | **Tonic**        | Heal 4, gain 4 Block                                   |
| Earth + Earth           | **Stoneskin**    | Gain 12 Block                                          |
| Air + Air               | **Tailwind**     | Draw 2 cards, gain 1 energy                            |
| Fire + Water            | **Steam**        | Apply 2 Weak to ALL enemies                            |
| Fire + Earth            | **Magma**        | Deal 8 damage, apply 3 Burn                            |
| Fire + Air              | **Wildfire**     | Deal 5 damage to ALL enemies                           |
| Water + Earth           | **Mud**          | Apply 2 Slow to an enemy (their next attack −30%)     |
| Water + Air             | **Rain Cloud**   | Set weather to **Rain**                                |
| Earth + Air             | **Sandstorm**    | Apply 1 Blind (next attack misses)                     |
| Fire + Fire + Air       | **Heat Haze**    | Set weather to **Heatwave**, gain 1 Strength          |
| Water + Air + Spark     | **Thunderhead**  | Set weather to **Storm**, the next bolt hits enemies only |
| Water + Frost           | **Ice Lance**    | Deal 10 damage, apply 1 Frozen (skip 1 action)        |
| Fire + Water + Earth + Air | **Philosopher's Draught** | Rare: gain 2 energy, draw 3, heal 5   |

Three-element recipes are stronger than two-element ones. A three-slot cauldron
can hold one three-element brew, or a two-element brew plus one element kept
for later.

### 4.4 Discovery and the Grimoire
- Recipes start **unknown**. When you brew one for the first time, it is
  written into the **Grimoire**.
- The Grimoire is saved between runs (meta-progression). Known recipes show a
  preview of the result before you brew.
- Some events and relics reveal recipes early.

### 4.5 Brewing outside combat
- **Ingredients** drop as rewards (e.g. “2× Ember”).
- At **Cauldron sites** on the map you can turn ingredients into **Potions**
  (single-use items for combat) or **Infuse** a card (permanently add an
  element to it).

---

## 5. Content Plan

### 5.1 Starting character: the Stormbrewer
- 75 HP. Starter deck: 4× Strike, 4× Defend, 1× *Gather Ember*, 1× *Gather Dew*,
  1× *Stir* (Brew).
- Starting relic: **Copper Cauldron**, whose first brew each combat is free
  (costs 0 energy).
- *Later characters:* the **Tempest Witch** (focused on weather control) and the
  **Rootkeeper** (Earth and Mist, poison-style damage over time).

### 5.2 Example cards
- *Gather Ember* (1): Add Fire. Deal 3 damage.
- *Stir* (1): Brew.
- *Summon Rain* (1): Set weather to Rain. Draw 1.
- *Lightning Rod* (Power, 2): When Storm bolts would hit you, they hit a random enemy instead.
- *Barometric Shift* (0): Swap the current weather with the next forecast slot.
- *Double Boil* (2): Brew, then brew again with the same contents.
- *Frostbite* (1, Attuned Snow): Deal 6. In Snow: apply 2 Frozen.

### 5.3 Enemies (Act 1 examples)
- **Drizzle Slime**: in Rain, splits into two when damaged.
- **Storm Caller** (Elite): alternates attacking with calling Storm.
- **Cinder Imp**: gains Strength in Heatwave.
- **Frost Golem**: gains 6 Block each turn in Snow, and its Block keeps.
- **Boss: The Eye of the Storm**: changes weather **every** round in a fixed,
  telegraphed cycle. In phase 2 it steals the top element of your cauldron.

### 5.4 Relics (examples)
- **Barometer**: the forecast shows 3 upcoming weathers instead of 1.
- **Weathervane**: whenever the weather changes, gain 3 Block.
- **Iron Cauldron**: +1 cauldron slot.
- **Alembic**: Sludge becomes a random known recipe instead.
- **Rain Barrel**: in Rain, gain 1 energy at the start of your turn.

### MVP content targets
~40 cards, 5 weathers, 4 base elements plus Spark and Frost, ~20 recipes,
~10 normal enemies, 3 elites, 1 boss, ~15 relics, 6 events, Act 1 only.

---

## 6. Technical Plan

### 6.1 Recommended stack
- **TypeScript + Vite**, running in the browser. It is easy to share (just a
  link), fast to iterate on, and a card game's UI works well with DOM/CSS.
- Rendering: plain DOM + CSS animations to start. Switch to **PixiJS** later if
  effects need it.
- Tests: **Vitest** for game-logic unit tests.
- Deploy: GitHub Pages.

*(If you would rather use Godot or Unity, the architecture below still applies.)*

### 6.2 Architecture
Keep **game logic separate from rendering** so rules can be tested and
balanced on their own.

```
src/
  core/            # pure game logic, no DOM
    state.ts       # RunState, CombatState
    combat.ts      # turn flow, energy, draw/discard
    effects.ts     # damage, block, status effects (single effect pipeline)
    weather.ts     # WeatherState, forecast queue, timers, modifiers
    cauldron.ts    # slots, brew resolution, recipe matching
    events.ts      # event bus: onTurnStart, onWeatherChange, onBrew...
    rng.ts         # seeded RNG (reproducible runs)
  data/            # content as data, not code
    cards.ts  enemies.ts  relics.ts  recipes.ts  weathers.ts
  ui/              # rendering and input
  main.ts
tests/
```

Important choices:
- **Effects pipeline**: every card, brew, weather effect, and relic produces
  `Effect` objects (e.g. `{type:'damage', amount:8, target}`). Weather and
  relics act as **modifiers** that hook into the pipeline, so “Rain: Fire −25%”
  is a single rule and not a check scattered across many cards.
- **Recipes as data**: `{ ingredients: ['fire','water'], result: 'steam' }`,
  matched on a sorted multiset key. This makes adding recipes trivial.
- **Seeded RNG**, so bugs and balance problems can be reproduced.
- **Save/load**: `RunState` is serialized to localStorage between map nodes.
  The Grimoire has its own save.

---

## 7. Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 0 | **Setup** | Vite + TS project, lint, Vitest, GitHub Pages deploy |
| 1 | **Combat core** | Deck/hand/energy, Strike/Defend, one enemy with intents, win/lose screens |
| 2 | **Weather** | 5 weathers, 3-round cycle, forecast UI, weather modifiers in the effects pipeline, 1 enemy that changes weather |
| 3 | **Brewing** | Cauldron UI, Element and Brew cards, 10 recipes, Sludge, weather ↔ brew interactions |
| 4 | **Playable fight loop** | 3–4 enemy types, card rewards after combat, a “sandbox” mode to test cards |
| 5 | **Run structure** | Branching Act 1 map, rest sites, shop, gold, relics, the Act 1 boss |
| 6 | **Discovery & out-of-combat brewing** | Grimoire (persistent), ingredients, Cauldron sites, potions |
| 7 | **MVP content & balance** | Reach the MVP content targets and playtest |
| 8 | **Polish** | Animations, sound, weather visuals (rain particles, lightning flashes), save/load |
| 9 | **Expansion** | Acts 2–3, Fog/Gale/Eclipse, a second character, ascension levels |

Milestones 1–3 prove the game's core idea. If combat with weather and brewing
is fun in a single fight, the rest is adding content.

---

## 8. Open Questions

1. **Platform/engine**: browser (TypeScript) as proposed, or Godot/Unity?
2. **Art direction**: pixel art, hand-drawn, or minimal/text-first for now?
3. **Recipe order**: should ingredient order ever matter (e.g. Fire then Water =
   Steam, Water then Fire = Hiss)?
4. **Weather cycle**: a fixed 3-round timer, or a random 2–4 rounds that the
   forecast shows?
5. **Scope**: one character for the MVP (recommended), or more?
