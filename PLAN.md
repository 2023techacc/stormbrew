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
4. **Brewing happens in the fight.** All brewing happens during combat, where
   weather and enemies make it matter. There is no separate crafting screen.
5. **Mobile first.** The game is designed for a phone in portrait mode with
   touch controls, then ported to other platforms.

---

## 2. Core Loop

```
Start run → Map (choose path) → Node
   ├─ Combat / Elite / Boss → Rewards (card, gold, potion, relic)
   ├─ Rest site (heal, upgrade a card, or infuse a card with an element)
   ├─ Shop (cards, relics, potions, card removal)
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
1. **Natural cycle**: weather changes on a **fixed schedule**, every **N rounds**.
   N is a single constant for the whole game and is never random. It starts at
   **3** and gets tuned in playtesting. The **Forecast** bar shows the current
   weather, a countdown to the next change, and what the next weather will be,
   which works like intents for the sky.
2. **Player**: cards (*Summon Rain*, *Clear Skies*), brews (Water + Air → *Rain
   Cloud*), potions, relics.
3. **Enemies**: some enemies call weather as their intent (e.g. *Storm Caller*:
   “Next turn: Storm”).
4. **Other sources**: map events, act themes (Act 2 leans toward Snow and Storm),
   boss phases.

Manually changing the weather **does not move the schedule**. It replaces the
current weather only until the next scheduled change. This keeps the rhythm
predictable: the player always knows when the sky will turn, and the decision is
whether a weather change is worth spending a card on for the rounds that are
left. Some rare cards and relics can explicitly **delay** or **skip** a
scheduled change (e.g. *Hold the Sky*: the next scheduled change is skipped).

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
- Order does **not** matter: recipes are matched as unordered sets, so Fire +
  Water and Water + Fire both make Steam. (A small number of rare, clearly
  marked exceptions could be added much later, but only if the base system
  feels too simple.)
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

### 4.5 Brewing only happens in fights
All brewing happens **inside combat**. There is no crafting screen and there
are no Cauldron sites on the map. Here is why:
- The fight is where brewing is interesting. Weather, enemy intents, and energy
  all change what the best brew is, so the same recipe can be a great or a bad
  move depending on the turn.
- Out-of-combat crafting splits the player's attention and slows the run down
  on mobile, where short sessions matter.
- There is less to build (one cauldron UI instead of two), so the core idea can
  be tested sooner.

How elements improve your deck between fights:
- **Element cards** are regular card rewards (e.g. *Gather Frost*), so building
  your deck *is* choosing your ingredients.
- **Bottling**: a few cards (e.g. *Bottle It*: the next brew is saved instead of
  used) turn an in-fight brew into a **Potion** that you can keep and use in a
  later fight. This is the only way to make potions yourself; potions can also
  drop as rewards or be bought in shops.
- Rest sites can **Infuse** a card (permanently add an element to it) instead
  of upgrading it.

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
- *Bottle It* (1): The next brew this turn is saved as a Potion instead of being used.
- *Hold the Sky* (2, Exhaust): Skip the next scheduled weather change.
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

## 6. Platforms & Art

### 6.1 Target platforms
1. **Android (APK)**: the main target.
2. **Web browser**: the same build runs on any phone or PC browser. It is also
   the quickest way to share test builds.
3. **iOS**: possible with the same code later. Building for iOS needs a Mac with
   Xcode, and publishing needs a paid Apple developer account.
4. **Desktop (Windows/Mac/Linux)**: optional later, by wrapping the web build
   with Tauri or Electron (e.g. for Steam or itch.io).

### 6.2 Mobile-first design
- **Portrait layout**: enemies and the forecast at the top, the cauldron in the
  middle, the hand at the bottom within reach of your thumb.
- **Touch controls**: tap a card to select it, then tap a target (drag to play
  is optional). Long-press shows details for any card, status effect, weather,
  or recipe.
- Large touch targets (at least 44px), readable text on small screens, and
  support for screen notches (safe areas).
- **Auto-save** after every action, because the phone may close the app at any
  time. Leaving mid-fight and coming back must work.
- Runs in 20–40 minutes, and a single fight takes a few minutes.

### 6.3 Art style: minimal (for now)
- Flat shapes, one icon set, and a limited color palette. No character art yet.
- Each element and weather has a color and an icon (e.g. Fire = orange 🔥),
  so the game can be read at a glance.
- Weather appears as a background color tint plus simple particles (rain lines,
  snow dots, a lightning flash).
- Cards are text plus an icon in a colored frame by type.
- All visuals come from a single theme file, so real art can be swapped in
  later without changing game code.

---

## 7. Technical Plan

### 7.1 Stack
- **TypeScript + Vite**: the game is a web app at its core.
- **Capacitor**: wraps the web app into a native **Android APK** (and an iOS app
  later) from the same code. It also provides access to phone features such as
  vibration, the back button, and file storage for saves.
- Rendering: plain DOM + CSS animations to start. Switch to **PixiJS** later if
  effects need it.
- Tests: **Vitest** for game-logic unit tests.
- **GitHub Actions**:
  - Every push runs tests and builds the web version (deployed to GitHub Pages).
  - An Android job builds an **APK** you can download from the Actions page and
    install on a phone, so no Android Studio is needed to try it.

### 7.2 Architecture
Keep **game logic separate from rendering** so rules can be tested and
balanced on their own.

```
src/
  core/            # pure game logic, no DOM
    state.ts       # RunState, CombatState
    combat.ts      # turn flow, energy, draw/discard
    effects.ts     # damage, block, status effects (single effect pipeline)
    weather.ts     # WeatherState, fixed schedule, forecast, modifiers
    cauldron.ts    # slots, brew resolution, recipe matching
    events.ts      # event bus: onTurnStart, onWeatherChange, onBrew...
    rng.ts         # seeded RNG (reproducible runs)
  data/            # content as data, not code
    cards.ts  enemies.ts  relics.ts  recipes.ts  weathers.ts
  ui/              # rendering and touch input
    theme.ts       # colors, icons (minimal art lives here)
  main.ts
android/           # generated by Capacitor
tests/
```

Important choices:
- **Effects pipeline**: every card, brew, weather effect, and relic produces
  `Effect` objects (e.g. `{type:'damage', amount:8, target}`). Weather and
  relics act as **modifiers** that hook into the pipeline, so “Rain: Fire −25%”
  is a single rule and not a check scattered across many cards.
- **Recipes as data**: `{ elements: ['fire','water'], result: 'steam' }`,
  matched on a sorted key (`"fire+water"`), so order never matters and adding
  recipes is trivial.
- **Weather schedule**: a round counter plus the constant `WEATHER_INTERVAL`
  (starts at 3). Manual changes only replace the current weather; they never
  touch the counter.
- **Seeded RNG**, so bugs and balance problems can be reproduced.
- **Save/load**: the whole game state is serialized after every action (local
  storage on web, device storage on Android). The Grimoire has its own save.

---

## 8. Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 0 | **Setup** ✅ | Vite + TS project (strict type checks), Vitest, Capacitor Android project, GitHub Actions building the web version **and a downloadable APK** |
| 1 | **Combat core** ✅ | Deck/hand/energy, Strike/Defend, one enemy with intents, win/lose screens, touch controls in portrait layout |
| 2 | **Weather** | 5 weathers, fixed-interval schedule, forecast UI with countdown, weather modifiers in the effects pipeline, 1 enemy that changes weather |
| 3 | **Brewing** | Cauldron UI, Element and Brew cards, 10 recipes, Sludge, weather ↔ brew interactions |
| 4 | **Playable fight loop** | 3–4 enemy types, card rewards after combat, a “sandbox” mode to test cards |
| 5 | **Run structure** | Branching Act 1 map, rest sites (including Infuse), shop, gold, relics, the Act 1 boss |
| 6 | **Discovery & potions** | Grimoire (persistent), Bottling, potions, auto-save and resume |
| 7 | **MVP content & balance** | Reach the MVP content targets, playtest on real phones, tune `WEATHER_INTERVAL` |
| 8 | **Polish** | Animations, sound, vibration feedback, weather particles, app icon and splash screen |
| 9 | **Expansion** | Acts 2–3, Fog/Gale/Eclipse, a second character, ascension levels, iOS/desktop builds |

Milestones 1–3 prove the game's core idea. If combat with weather and brewing
is fun in a single fight on a phone, the rest is adding content.

---

## 9. Decisions So Far

| Topic | Decision |
|-------|----------|
| Platforms | Android APK first, plus web; iOS/desktop later if possible |
| Engine | TypeScript + Vite, wrapped with Capacitor for mobile |
| Art | Minimal for now (shapes, icons, color) |
| Recipe order | Does not matter |
| Weather timing | Fixed interval (N rounds, starting at 3); manual changes don't move the schedule |
| Brewing location | Only inside fights; potions come from Bottling, rewards, and shops |
| Scope | One character (the Stormbrewer) for the MVP |

## 10. Open Questions

1. **Weather interval**: is 3 rounds right? This will be tested in milestone 2
   and tuned in milestone 7.
2. **Store release**: sideloaded APK only, or eventually Google Play? (Google
   Play needs a one-time $25 developer account and a signed release build.)
3. **Sludge**: should failed brews be a small random effect (friendlier) or add
   a curse card (harsher, more *Slay the Spire*-like)?
