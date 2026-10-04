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
| **Rain**   | Fire damage −25%.                                          | Adds a free **Water** to every brew  |
| **Storm**  | End of each round: a lightning bolt hits a random unit for 5. | Adds a free **Spark** to every brew  |
| **Heatwave** | Everyone gains 1 Burn per turn. Fire damage +25%.       | Adds a free **Fire** to every brew   |
| **Snow**   | Block is **not** removed at turn start (both sides).       | Adds a free **Frost** to every brew  |
| *Later:* **Fog** | Intents hidden; 20% miss chance on attacks.         | Brew results hidden until resolved   |
| *Later:* **Gale** | Top card of draw pile discarded each turn; Air +1. | Air elements count double            |
| *Later:* **Eclipse** (rare) | All brews are “inverted” (buffs ↔ debuffs). | —                                    |

*Status:* the five MVP weathers are in the game. Their brewing interaction is
now **Exposure** (§11): standing out in the weather drops its element (Rain 💧,
Storm ⚡, Heatwave 🔥, Snow ❄️) into your cauldron each turn. This replaced the
earlier rule where every brew got the weather's element for free.

### 3.2 How weather changes
1. **Natural cycle**: each weather lasts a **fixed number of turns**, then
   changes to the forecast weather. The forecast is drawn from your **Sky Deck**
   of weather cards (§11); a basic card lasts 3 turns, and some cards last
   longer or shorter (Monsoon: 5, Squall: 2). Durations are fixed, never random. The **Forecast** bar shows the current
   weather, a countdown to the next change, and what the next weather will be,
   which works like intents for the sky.
2. **Player**: cards (*Summon Rain*, *Clear Skies*), brews (Water + Air → *Rain
   Cloud*), potions, relics.
3. **Enemies**: some enemies call weather as their intent (e.g. *Storm Caller*:
   “Next turn: Storm”).
4. **Other sources**: map events, act themes (Act 2 leans toward Snow and Storm),
   boss phases.

Changing the weather with a card, brew or enemy move **restarts the countdown**:
the new weather lasts a full N turns (for an enemy's change, counting from your
next turn). Summoning the weather that is already active extends it, so the
player can hold a good weather by recasting it. The forecast (what comes next)
stays the same; if it showed the weather that was just summoned, it skips ahead
so the next change always changes something.

### 3.3 Weather-related keywords
- **Attuned (X)**: a bonus while the weather is X. An Attuned card shows its
  weather in a corner and glows while that weather is here (*Frostbite*: in
  Snow, also apply 2 Weak). Enemy moves can be Attuned too (the Snow Wolf
  pounces harder in Snow).
- **Forecast**: look at or change an upcoming weather slot.
- **Weathered (X)**: this enemy ignores the harmful effects of weather X
  (it can't be hit by Storm lightning, or doesn't gain Heatwave Burn).
- **Sheltered**: this enemy is always under cover, so the weather never
  reaches it (the Drizzle Slime).
- **Hunter** 🎯: this enemy hits harder when you're out in the open (the Sky
  Hawk and the Storm Roc). Its intent shows the higher number while you're Out.
- **Burn**: at the end of your turn, lose HP equal to your Burn (ignoring
  Block), then Burn goes down by 1.

---

## 4. Brewing System

### 4.1 Elements
- **Base elements** (from Gather cards): 🔥 Fire, 💧 Water, 🪨 Earth, 🌬️ Air
- **Weather-born elements** (from the weather, and later relics or rare cards):
  ⚡ Spark (Storm), ❄️ Frost (Snow); later maybe ☀️ Sunlight, 🌫️ Mist

### 4.2 The Cauldron
- Has **3 slots** by default. Relics can increase this to 4 or 5.
- **Element** cards (*Gather Ember/Dew/Stone/Gust*) add elements to empty slots.
  Elements stay in the cauldron between turns.
- Playing a **Brew** card (*Stir*, 0 energy) **brews**, and the result fires
  right away. The cauldron really holds 3 elements, so you choose when to brew;
  adding an element to a **full** cauldron brews it first to make room (the
  preview warns you), so a Gather card never wastes its element. When brewing:
  1. The **largest** matching recipe is brewed; among recipes of the same size,
     the **oldest** elements are used first.
  2. Elements the recipe didn't use **stay** for later.
- The weather adds elements through **Exposure** (§11): out in the open, its
  element falls into the cauldron at the start of your turn. (An early version
  added the weather's element to every brew for free instead.)
- The cauldron always previews what brewing now would make, and a recipe book
  lists every recipe (unknown ones show as ???, see §4.4).
- Order does **not** matter: recipes are matched as unordered sets, so Fire +
  Water and Water + Fire both make Steam. (A small number of rare, clearly
  marked exceptions could be added much later, but only if the base system
  feels too simple.)
- Contents that match no recipe produce **Sludge**: gain 2 Block. (Friendly for
  now; a harsher version can come with difficulty levels.)

### 4.3 Recipe table

The game has 27 recipes (see `src/data/recipes.ts`): every pair of base
elements, every weather element with every base element, the weather elements
with each other (Overcharge ⚡⚡, Ice Storm ❄️❄️, Frozen Lightning ⚡❄️), and six
three-element brews (Heat Haze, Thunderhead, Downpour, and from Milestone 10
Volcano 🔥🔥🪨, Glacier ❄️🪨🪨 and Tincture 💧🪨🌬️). The table below shows the
original examples; some changed in the game (e.g. Mud and Sandstorm use
Weak/Block instead of Slow/Blind, Heat Haze deals damage instead of giving
Strength, Ice Lance applies Weak).

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
for later. Because the biggest recipe always wins, a three-element brew
replaces the two-element brew inside it *and* the element that would have been
kept, so it has to be worth about one and a half brews: the first versions of
Volcano, Glacier and Tincture weren't, and made runs harder (§12.6).

### 4.4 Discovery and the Grimoire
- Recipes start **unknown**. When you brew one for the first time, it is
  written into the **Grimoire**.
- The Grimoire is saved between runs (meta-progression). Known recipes show a
  preview of the result before you brew; unknown ones show as **???** in the
  cauldron preview and the recipe book. (The sandbox shows everything.)
- Some events and relics reveal recipes early (later).
- *Status:* in the game (Milestone 6), together with **Bottle It** / potions
  (up to 3, free to drink, also found after fights and sold in shops) and
  **auto-save** (the run, even mid-fight, is saved after every action; the
  title screen offers **Continue run**).

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
- 80 HP (75 while the game was one act long). Starter deck (12 cards): 2× Strike, *Pilfer*, 3× Defend, *Gather
  Ember*, *Gather Dew*, *Gather Stone*, *Gather Gust*, *Stir* (Brew) and
  *Summon Rain*.
- Starting relic: **Copper Cauldron**: start each fight with a random base
  element in the cauldron. (Originally "first brew free", but Stir already
  costs 0.)
- *Later characters:* the **Tempest Witch** (focused on weather control) and the
  **Rootkeeper** (Earth and Mist, poison-style damage over time).

### 5.2 Cards

55 cards are made by hand (`src/data/cards.ts`), 8 of them rare (§5.7), and
every recipe adds two distilled cards (a Flask and an Essence, §11), 109 in all:
- **Basics**: Strike, Defend, Brace, Ember Bolt, Thunderclap, *Hailstones*
  (3 frost damage 3 times).
- **Elements**: *Gather Ember / Dew / Stone / Gust*, *Twin Embers*, *Deluge*,
  *Riptide* (deal 5, add 💧), *Gale Force* (3 to ALL, add 🌬️), *Earthen Wall*
  (12 Block, add 🪨), *Static Charge* (add ⚡, draw 1), *Rime* (4 Block, add ❄️),
  *Catch the Sky* (add the weather's element, draw 1), *Fan the Flames*
  (4 Burn, add 🌬️).
- **Brewing**: *Stir*, *Double Boil*, *Simmer* (5 Block, brew), *Catalyst*
  (the next brew works twice), *Boil Over* (empty the cauldron: 4 damage per
  element), *Bottle It*, *Whisk* (brew, draw 2).
- **Weather**: *Summon Rain*, *Clear Skies*, *Kindle*, *Call Lightning*,
  *First Frost*, *Cloudburst* (Rain, 7 to ALL), *Shift Winds*, *Hold the Sky*,
  *Scatter Clouds*, *Weather Front* (the next weather comes now), *Fog Bank*
  (7 Block, change the next weather).
- **Attuned** (§3.3): *Frostbite* (Snow: 2 Weak), *Sunstrike* (Heatwave:
  3 Burn), *Static Shock* (Storm: +1 energy), *Undertow* (Rain: draw 2),
  *Clarity* (Clear: draw 2 more), *Forked Lightning* (Storm: 4 to ALL too),
  *Snowdrift* (6 Block; Snow: draw 2), *Heat Shimmer* (5 fire to ALL;
  Heatwave: 2 Burn to ALL).
- **Against enemy cauldrons**: *Pilfer*, *Curdle*.
- **Rare** (§5.7): *Conductor*, *Steady Hands*, *Sky Harvest* (Lasting),
  *Perfect Brew*, *Lightning Storm*, *Sunbreak*, *Hoarfrost*, *Avalanche*.

### 5.3 Enemies (Act 1: the Mirelands)

Each enemy uses the weather, the cauldron or your stance in its own way. The
numbers come from the balance passes (§12). Acts 2 and 3 are in §5.6.

| Enemy | HP | What it does |
|-------|----|--------------|
| **Cinder Imp** | 46 | Fire attacks; Weathered (Heatwave) |
| **Storm Caller** | 44 | Calls Storm, shuffles two Storms into your sky; Weathered (Storm) |
| **Drizzle Slime** | 30 | Spit makes you Weak; Sheltered. Often the second enemy in a fight |
| **Mire Witch** | 40 | Brews Fireball, then Tonic, in its own cauldron |
| **Sky Hawk** | 34 | Hunter: its Dive hits 7 harder while you're Out |
| **Bog Toad** | 44 | Calls Rain, steals your newest element, brews Mud; belly-flops harder in Rain |
| **Rainmaker** | 40 | Shuffles a Monsoon into your sky; shields itself in Rain |
| **Frost Golem** | 64 | Heavy Slams; brews Permafrost for itself, then Ice Lance at you |
| **Snow Wolf** | 50 | Attuned: pounces 6 harder in Snow |
| **Spark Wisp** | 24 | Comes in pairs; brews Ball Lightning; Weathered (Storm) |

The first three floors use one easy enemy (or two slimes); later floors use the
Golem, the Wolf, or a pair.

**Elites** each test one part of the game, and give a relic:
- **Storm Roc** (100 HP), *exposure*: calls Storm, dives for 26 at a player out
  in the open (16 under cover), and adds two Squalls to your sky.
- **Cauldron Crone** (95 HP), *brewing*: a three-slot cauldron that brews Heat
  Haze (Heatwave, fire at you) and Downpour (Rain, heals itself), and a Snatch
  that steals from your cauldron. *Pilfer* and *Curdle* are made for her.
- **Cinder Drake** (100 HP), *the sky*: calls a Heatwave, adds a Heat Dome to
  your sky, and breathes fire that is strongest in a Heatwave.

**Boss: the Eye of the Storm** (150 HP): changes the weather every round in a
fixed cycle (Rain, Storm, Heatwave, Snow). Below half HP its moves hit harder
and two of them steal your newest element into its own cauldron, which it
brews against you.

Ideas for later: a Drizzle Slime that splits in Rain, enemies that gain
Strength over a fight.

### 5.4 Relics

23 relics (found at elites, events and shops), plus 6 boss relics (§5.6):
- **Copper Cauldron** (starting relic): start each fight with a random base element.
- **Barometer**: the forecast shows the next two weathers.
- **Weathervane**: whenever the weather changes, gain 3 Block.
- **Wind Chime**: whenever the weather changes, draw a card.
- **Iron Cauldron**: the cauldron has 4 slots.
- **Rain Barrel**: in Rain, gain 1 extra energy each turn.
- **Snow Globe**: in Snow, gain 3 Block at the start of your turn.
- **Lightning Rod**: Storm lightning never hits you.
- **Sun Stone**: Heatwave never gives you Burn.
- **Umbrella**: under cover, gain 4 Block at the start of your turn.
- **Dewcatcher**: whenever the weather drops an element into your cauldron, gain 2 Block.
- **Cloud Seed**: fights start in a weather from your sky instead of Clear.
- **Alembic**: Sludge becomes a random brew of two base elements.
- **Healing Herb**: heal 6 HP after each fight you win.
- **Lucky Coin**: gain 10 extra gold from each fight.
- From Milestone 10 (§5.7): **Ember Charm** and **Frost Charm** (+1 to every
  Burn / Weak you apply), **Kiln** (in a Heatwave, +1 energy each turn),
  **Sunlit Lantern** (in Clear skies, draw 1 more card each turn), **Belt
  Pouch** (carry 1 more potion; comes with one), **Hearty Stew** (+10 max HP),
  **Master's Notes** (+1 energy for every three-element brew) and **Golden
  Scale** (shops 20% cheaper, starting with the one you buy it in).

### 5.5 Events

Event spots (❓) appear on the map from floor 2. Each run shows the events
in a random order without repeats. Every event has 2–3 choices, and a choice
you can't take says why (not enough gold or HP, a full potion belt…):
- **Abandoned Cauldron**: drink it (heal 15), study the residue (learn 2
  recipes for your Grimoire), or bottle it (a random potion).
- **Lightning-Struck Oak**: carve a charm (infuse a card with ⚡ Spark, which
  rest sites can't do) or take the heartwood (+5 max HP).
- **Weather Shrine**: pray for calm (remove a weather card from your sky) or
  leave an offering (25 gold: choose 1 of 3 weather cards to add).
- **Storm Chaser**: chase the storm (fight an elite for its relic) or buy
  their gear (80 gold: a random relic).
- **Frozen Traveler**: thaw them (lose 8 HP, gain a relic) or take the pack
  (45 gold).
- **Wandering Alchemist**: trade a card (it becomes a random card) or buy a
  lesson (30 gold: learn 3 recipes).

From Milestone 10 some events only happen in certain acts, so each act has
6–10 to draw from:
- **Old Observatory** (every act): study the sky (learn 3 recipes) or chart
  a new course (choose 1 of 3 weather cards to add, for free).
- **Frozen Lake** (Act 2): break the ice (lose 7 HP: choose 1 of 3 rare
  cards) or chill a card (infuse it with ❄️ Frost).
- **Lightning Forge** (Acts 2–3): melt down a card (remove it from the deck)
  or work the bellows (lose 6 HP, gain 60 gold).
- **Sky Merchant** (Acts 2–3): buy a rare card (70 gold: choose 1 of 3) or a
  potion (20 gold).
- **Storm Altar** (Act 3): offer your strength (lose 8 max HP: a random
  relic) or pray for calm (heal 25).

### 5.6 Acts 2 and 3 (Milestone 10)

A run is **three acts**, each a map of 10 floors and a boss. Three acts keep a
run to one sitting on a phone (about 40–60 minutes) while leaving room for a
deck to grow and change, like most games of this kind. Beating an act's boss
gives gold and a card, then **one of three boss relics**, and you **heal fully**
before the next act's map. Floors count on across acts (Act 2 starts at floor
12). Beating the Act 3 boss wins the run.

New enemy moves: **many-hit attacks** (e.g. 4×3, so Weak and Block matter per
hit), **self-healing**, and **shatter**, which breaks all your Block before the
hit.

**Act 2: the Frostpeaks** (snow and storm). Snow keeps everyone's Block, and
here the cold enemies *shatter* yours: in Snow their walls of ice pile up while
yours crack, so changing the weather matters.

| Enemy | HP | What it does |
|-------|----|--------------|
| **Ice Bat** | 26 | Comes in pairs; Swoop hits twice, harder while you're Out; Weathered (Snow) |
| **Frost Mammoth** | 72 | Calls Snow; Trample shatters your Block |
| **Sleet Sprite** | 44 | Brews Ice Lance at you every other turn |
| **Thunder Ram** | 72 | Charges harder in Storm; Weathered (Storm) |
| **Storm Eel** | 58 | Two-hit Jolts, adds a Storm to your sky, discharges harder in Storm |

Elites: **Glacier Titan** (140 HP: walls itself in Snow, shattering Crush),
**Rime Witch** (120 HP: a three-slot cauldron of Blizzard, Ice Lance and
Permafrost, steals, shattering Ice Shards), **Thunder Owl** (165 HP: a Storm
hunter with a three-hit flurry). Boss: the **Frost Wyrm** (210 HP): Snow is its
fortress; it shatters, hibernates to heal, and turns savage below half HP.

**Act 3: the Sky Citadel** (heat, lightning, many-hit attacks).

| Enemy | HP | What it does |
|-------|----|--------------|
| **Lava Lizard** | 76 | Burns you, basks in a Heatwave; Weathered (Heatwave) |
| **Storm Elemental** | 90 | Three-hit Whirl, adds two Squalls to your sky, lashes harder in Storm |
| **Brass Automaton** | 100 | Heavy Pistons and Plating; brews Plasma Bolt at you |
| **Ember Wraith** | 60 | Weak and Burn; Sheltered (a ghost: the weather passes through it) |
| **Cloud Shark** | 80 | Hunter: strikes from above while you're Out; three-hit Frenzy |

Elites: **Magma Colossus** (215 HP: Heatwave, Heat Domes, lava), **Tempest
Djinn** (200 HP: Storm and three-hit gusts), **Grand Alchemist** (190 HP:
brews Thunderhead and Heat Haze, steals, heals itself). Final boss: the
**Heart of the Storm** (280 HP): Weathered to Storm, Heatwave and Snow; a
four-hit lightning barrage, its own cauldron, and a harder second half.

**Boss relics** (one of three after the Act 1 and Act 2 bosses; the energy ones
have a catch):
- **Storm Vow**: +1 energy each turn; you can never take cover.
- **Sky Anchor**: +1 energy each turn; the weather no longer changes on its own.
- **Philosopher's Stone**: +1 energy each turn; the cauldron has 1 slot less.
- **Grand Grimoire**: whenever you brew, draw a card.
- **Bottomless Flask**: carry 2 more potions; start each fight with a random potion.
- **Thunder Drum**: Storm lightning never hits you, and strikes twice each round.

Part 2 of Milestone 10 added rare cards, relics, recipes, potions and events
(§5.7).

### 5.7 Rare cards, relics, potions and events (Milestone 10, part 2)

- **Rarity.** Cards are common or **rare** (a gold edge and a ★). Each card
  in a reward can be rare: 8% after normal fights in Act 1, 14% in Act 2 and
  20% in Act 3, and 25% / 30% / 35% after elites. After an act's boss all
  three cards are rare. Every shop sells two common cards and one rare
  (70–85 gold), and the Frozen Lake and Sky Merchant offer a choice of three.
- **Lasting cards.** Three rares are *Lasting*: once played they leave the
  fight, and their effect stays until it ends. They show as small badges next
  to your name in the fight (tap one to read it), and more copies stack.
  - **Conductor** (1 energy): whenever the weather changes, 5 damage to ALL
    enemies.
  - **Steady Hands** (1): every brew also gives 4 Block.
  - **Sky Harvest** (1): out in the open, you catch the weather's element
    twice each turn.
- **The other rares**: *Perfect Brew* (1: brew, and it works twice),
  *Lightning Storm* (2: Storm, 10 to ALL), *Sunbreak* (0: Clear, +1 energy),
  *Hoarfrost* (1: double your Block) and *Avalanche* (1: damage equal to your
  Block), which reward piling up Block in Snow.
- **Recipes**: *Overcharge* (⚡⚡: +2 energy), *Ice Storm* (❄️❄️: 2 Weak to
  ALL, 5 Block), *Frozen Lightning* (⚡❄️: 15 lightning damage), *Volcano*
  (🔥🔥🪨: 12 fire and 3 Burn to ALL), *Glacier* (❄️🪨🪨: Snow, 18 Block) and
  *Tincture* (💧🪨🌬️: 12 Block, draw 2). Each comes with its Flask and Essence.
  Catching the same weather twice (Sky Harvest) now always brews something:
  Rain makes Tonic, Storm Overcharge, Heatwave Fireball and Snow Ice Storm.
- **Potions by act**: potions found after fights, sold in shops and given by
  events are two-base-element brews in Act 1; from Act 2 also brews with ⚡ or
  ❄️, and in Act 3 also three-element brews.
- **Relics and events**: 8 relics (§5.4) and 5 events, most of them for the
  later acts (§5.5). Two new kinds of event choice: remove a card from your
  deck, and choose one of three rare cards.

| | In the game now |
|---|---|
| Cards | 55 made by hand (8 rare, 3 of them Lasting), plus 54 distilled |
| Recipes | 27 |
| Relics | 23, plus 6 boss relics and the starting relic |
| Events | 11 (6 to 10 in each act) |
| Enemies | 20 normal enemies, 9 elites and 3 bosses over three acts |

### MVP content targets (reached in Milestone 8)

| | Target | In the game |
|---|---|---|
| Cards | ~40 | 40, plus 42 distilled |
| Weathers | 5 | 5 |
| Elements | 4 base, plus Spark and Frost | ✅ |
| Recipes | ~20 | 21 |
| Normal enemies | ~10 | 10 |
| Elites | 3 | 3 |
| Boss | 1 | 1 |
| Relics | ~15 | 15 |
| Events | 6 | 6 |
| Acts | 1 | 1 |

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
- **No scrolling**: every screen fits between the phone's status bar and
  navigation bar. A fight is exactly that tall; on shorter phones the enemies,
  cards, cauldron and gaps shrink smoothly (full size from 760px of height,
  compact at 600px), and a long fight message scrolls inside its own area. The
  map stretches or squeezes its floors to fill the screen. (Checked from
  360×600 to 412×800, in both languages.)
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
- **Planned: an art revamp.** Playtesting says the icon, sounds and animations
  work, but the enemy and card pictures (emoji for now) should be redrawn
  overall later on, with a consistent style.

### 6.4 Languages
- **English** (the default), **Korean**, **Japanese**, **Simplified Chinese**
  and **Spanish**, chosen on the title screen under ⚙️ Settings and saved on
  the device. The page's `lang` tag follows the language (`zh-CN` for
  Chinese), so phones pick the right fonts and line-breaking rules.
- Every text goes through `src/i18n`: `t()` for interface messages (the key
  list is `src/i18n/en.ts`; the type checker makes sure every language has
  every key), and helpers like `cardName()` for game content (English lives in
  `src/data`, the other languages in content tables like
  `src/i18n/ja-content.ts`). Tests check that every table has all the content
  and nothing left over, and that translations use the same `{placeholders}`
  as English (and keep `{damage}` wherever English shows damage).
- Lists, colons and exclamations follow each language too (`、` and `：` in
  Japanese and Chinese, `¡…!` in Spanish), so even text put together in code
  goes through `t()`.
- Korean particles (이/가, 을/를, 은/는, 과/와, 으로/로) are picked to fit the
  word before them, so messages read naturally with any card or enemy name.
  Korean text wraps between words, not inside them.
- Cards are narrow (68px), so card texts are short in every language:
  - Japanese card names wrap between phrases (砂嵐の|フラスコ). Recipe names
    are at most four characters so a Flask's name fits on two lines.
  - Chinese text can wrap between any two characters.
  - Spanish card texts drop the verb from Block when a card does more than
    one thing («Clima: Nieve. 7 de Bloqueo.»). Long recipes have a shorter
    card text for their Flask, as in English.
  - Every card fits at 360×600 in every language (checked in a browser).
- Adding a language means adding its message file and content table, and
  listing them in `src/i18n/index.ts` and `src/i18n/content.ts`.

### 6.5 Feel: sound, vibration and motion (Milestone 9)
- **Sound**: short effects made in code with the Web Audio API (no audio
  files), in keeping with the minimal style: card plays, hits, Block, elements
  dropping in, brewing, thunder, weather changes, coins, victory and defeat.
  Phones only allow sound after the first touch, so audio starts then.
- **Vibration** (Capacitor Haptics; the vibration API in browsers that have
  one), kept for the moments that matter: a real hit (6+ damage in one go,
  stronger from 12), lightning striking you, victory and defeat. Brewing and
  tapping a card you can't play only make a sound (playtest: buzzing was too
  frequent).
- **Weather sky**: one canvas behind the page, tinted in the weather's color,
  with rain streaks, slanted storm rain, snowflakes, rising embers or slow
  motes. A new weather rolls in while the old one fades out, and lightning
  flashes the sky.
- **Motion**: screens fade in, drawn cards slide in from the draw pile, a
  played card flies to its target, attacking enemies lunge, and elements pop
  into the cauldron.
- **Settings** can turn sound, vibration and weather effects off (effects off
  also stops the livelier animations). Phones set to reduce motion get no
  particles or animations.
- **App icon and splash screen**: lightning from a storm cloud into a bubbling
  cauldron, on the game's night blue. The art is plain shapes in
  `resources/icon.svg`, and the Android icon and splash screen use the same
  shapes as a vector, so they are sharp on every screen.

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
  - Each new version merged into `main` is published as a **GitHub Release**
    with the APK, tagged `v0.12.0` and so on. Every APK is signed with the same key, so a new
    version installs over the old one and keeps the saves.

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
- **Weather countdown**: the turn of the next change (`nextChangeTurn`) plus the
  constant `WEATHER_INTERVAL` (starts at 3); any weather change sets
  `nextChangeTurn` N turns ahead.
- **Seeded RNG**, so bugs and balance problems can be reproduced.
- **Save/load**: the whole game state is serialized after every action (local
  storage on web, device storage on Android). The Grimoire has its own save.

---

## 8. Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 0 | **Setup** ✅ | Vite + TS project (strict type checks), Vitest, Capacitor Android project, GitHub Actions building the web version **and a downloadable APK** |
| 1 | **Combat core** ✅ | Deck/hand/energy, Strike/Defend, one enemy with intents, win/lose screens, touch controls in portrait layout |
| 2 | **Weather** ✅ | 5 weathers, fixed-interval schedule, forecast UI with countdown, weather modifiers in the effects pipeline, 1 enemy that changes weather |
| 3 | **Brewing** ✅ | Cauldron UI, Element and Brew cards, 10 recipes, Sludge, weather ↔ brew interactions |
| 4 | **Playable fight loop** ✅ | 3–4 enemy types, card rewards after combat, a “sandbox” mode to test cards |
| 5 | **Run structure** ✅ | Branching Act 1 map, rest sites (including Infuse), shop, gold, relics, the Act 1 boss |
| 6 | **Discovery & potions** ✅ | Grimoire (persistent), Bottling, potions, auto-save and resume |
| 7 | **Identity** (A–D done, see §11) | The features that make Stormbrew play differently from *Slay the Spire*: Exposure, enemy cauldrons, the Sky Deck, Distilling |
| 8 | **MVP content & balance** ✅ | MVP content targets reached (§5), events, a balance pass with a computer player and `WEATHER_INTERVAL` tested (§12). Playtesting on real phones is still to do |
| 9 | **Polish** (in progress) | Languages (English, Korean, Japanese, Simplified Chinese and Spanish) ✅. Round 1 ✅: animations, sound, vibration feedback, weather particles, app icon and splash screen (§6.5). Round 2 ✅: every screen fits the phone without scrolling (§6.2), fewer vibrations. Later: new enemy and card art (§6.3). Next rounds follow feedback from playing on a phone |
| 10 | **Expansion** (in progress) | Acts 2–3 with their own enemies, elites and bosses, and boss relics ✅ (§5.6). Rare and Lasting cards, relics, recipes, potions by act and events ✅ (§5.7). Later: Fog/Gale/Eclipse, a second character, ascension levels, iOS/desktop builds |

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
| Weather timing | Each weather lasts a fixed 3 turns (weather cards can last 2 or 5), never random; any weather change restarts the countdown. 2 and 4 were tested too (§12) |
| Brewing location | Only inside fights; potions come from Bottling, rewards, and shops |
| Weather ↔ brewing | Exposure: out in the open, the weather drops its element (Rain → Water, Storm → Spark, Heatwave → Fire, Snow → Frost) into your cauldron each turn |
| Identity | Built A (Exposure), B (enemy cauldrons), C (Sky Deck), D (Distilling: up to 2 of 3 rewards, repeats at 25%) |
| Sludge | Friendly: a failed brew gives 2 Block |
| Act 1 structure | 10-floor branching map (4 lanes, paths never cross): fights, elites, events, rest sites, shops, then the boss. HP carries over (no free heal); rest sites heal 30%, Infuse or chart the sky |
| Difficulty | A strong computer player wins about 60% of runs and random play never wins (§12). Healing brews are small (Tonic heals 2, Thaw 3, Downpour 3) so fights can't be dragged out to heal |
| Rewards | Fights: 12–18 gold + pick 1 of 3 cards; elites: 28–35 gold + a relic + a card. Now and then a card is rare, more often after elites and in later acts; after an act's boss all three are (§5.7). Start with 50 gold |
| Shops | 2 common cards (40–55 gold) and 1 rare (70–85), 2 relics (110–140), a potion, a weather card and one card removal (60) per visit |
| Crowded hands | Cards keep their size and overlap instead of shrinking |
| Scope | One character (the Stormbrewer) for the MVP |
| Languages | English (default), Korean, Japanese, Simplified Chinese and Spanish, chosen in Settings (§6.4) |
| Run length | Three acts of 10 floors and a boss; a full heal and a choice of boss relics between acts (§5.6). The player has 80 max HP |
| Releases | Every version is tagged (`vX.Y.Z`) and published as a GitHub Release with the APK; test builds share one signing key so updates keep your progress |
| Sound | Made in code (Web Audio), no audio files; sound, vibration and weather effects each have an on/off setting (§6.5) |

## 10. Open Questions

1. **Difficulty for people**: the numbers were tuned with a computer player
   (§12). Playtesting on phones will show whether the game is too hard or too
   easy for people, and whether 3 turns of weather feels right.
2. **Store release**: sideloaded APK only, or eventually Google Play? (Google
   Play needs a one-time $25 developer account and a signed release build.)
3. **Stir cost**: Stir costs 0, and the Copper Cauldron became "start with an
   element" instead of "first brew free". Revisit during balancing.
4. **Identity**: which of the §11 features to build, and in what order.
5. **Snow** is the strongest weather for the player, because Block stacks up
   for as long as it lasts. Letting only half the Block wear off made little
   difference in the balance runs, so the simple rule stays; watch it in playtests.

---

## 11. Making Stormbrew Its Own Game

### 11.1 What is still *Slay the Spire*

Playtesting shows the core still feels like *Slay the Spire*: every turn is
"spend 3 energy on 5 cards, read the enemy's intent, end turn", and the run is
"pick 1 of 3 cards, walk a node map, rest or shop, beat the boss". Weather and
brewing are real, but they sit **on top of** that loop as modifiers instead of
**changing** it. The player's decisions each turn are almost the same as in
*Slay the Spire*; the cauldron is a side pocket.

The fix is not more content. It is a few rules that change *what the player
decides*, and they should all come from the two pillars: **the sky** and **the
cauldron**.

### 11.2 Proposed features

Each one is rated for how much it changes the game (impact) and how much work
it is (cost).

**A. Exposure: stand in the open or take cover** (impact: high, cost: small)
- Every turn you choose **Out** or **Under cover** (a toggle next to End turn).
- **Out**: the weather's element **falls into your cauldron** at the start of
  your turn (Rain drops 💧, Storm drops ⚡…) and you take the weather's harm
  (lightning, Burn). **Under cover**: safe from the weather, but no free element.
- Enemies have fixed positions too: flying enemies are always Out, burrowing
  ones always under cover, so the weather hits them differently.
- This replaces today's "every brew gets the weather's element for free" with a
  real choice made every turn, which *Slay the Spire* has nothing like.

**B. Enemies brew too** (impact: high, cost: medium)
- Some enemies have their own small cauldron on screen. Their intent shows the
  elements they are collecting; when it fills, their brew goes off (e.g. a
  Frost Golem brewing *Permafrost*).
- You can interfere: cards and brews that **steal** an element from an enemy
  cauldron into yours, or **spoil** it by adding a wrong element (their
  Fireball becomes Sludge).
- Fights become a race and a puzzle over *the same elements*, not just
  "block the attack intent".

**C. The Sky Deck: build your weather** (impact: high, cost: medium)
- The forecast is drawn from a second, small deck of **weather cards** that you
  build during the run, alongside your normal deck. You start with Clear, Rain,
  Storm, Heatwave and Snow.
- Rewards and shops sometimes offer weather cards (e.g. *Monsoon*: Rain for 5
  turns; *Dry Storm*: Storm whose lightning only hits enemies; *Aurora*: every
  brew gets one extra element). You can also **remove** weathers you don't want.
- Enemies and bosses **shuffle their weather into your sky** (the Storm Caller
  adds two Storms). Cards like *Read the Sky* look at and reorder the next
  weathers.
- Two decks to build (your hand and your sky) that have to work together: a
  deckbuilder idea of its own.

**D. Distilling: your deck grows from your brews** (impact: medium-high, cost: medium)
- After a fight, each recipe you brewed in it can be **distilled into a card**
  (e.g. brewing Magma unlocks a *Magma Flask* card). You choose one to add to
  the deck.
- The random "pick 1 of 3" card reward mostly goes away (shops still sell
  cards). Your deck becomes a record of what you learned to brew, and the
  Grimoire turns into deckbuilding, not just a list.
- Brewing still happens only in fights, as decided earlier.

**E. The storm front on the map** (impact: medium, cost: medium-large)
- A storm front moves up the map one row each time you move. Spots it covers
  become Storm fights with better rewards, and rest sites inside it are closed.
- You choose between racing ahead of the storm and diving into it for loot:
  the map itself becomes about weather, instead of a static node map.

**F. Elements replace energy** (impact: very high, cost: large; a bold option)
- No energy: cards cost elements from the cauldron, and the weather and Gather
  cards refill it. Brewing and playing cards become one system.
- This would make Stormbrew the least like *Slay the Spire*, but it means
  redesigning every card and rebalancing everything, so it should only be
  tried after A–D, as a separate experiment.

### 11.3 What was built (Identity milestone)

- **A. Exposure**: an Out/Cover toggle next to End turn. Out, you catch the
  weather's element each turn (it spills if the cauldron is full) but
  lightning and Heatwave Burn can reach you; under cover you're safe and catch
  nothing. Sheltered enemies (the Drizzle Slime) are never hit by the weather.
- **B. Enemy cauldrons**: the Mire Witch (Fireball, then Tonic), the Frost Golem
  (Permafrost) and the boss (brews what it steals from you) fill their own
  cauldrons; intents show an incoming brew's damage. *Pilfer* steals an element
  from an enemy's cauldron (it's in the starter deck), *Curdle* spoils their next
  brew. Watching an enemy brew teaches you the recipe.
- **C. The Sky Deck**: the forecast is drawn from your weather cards. You start
  with one of each basic weather; shops sell more (Monsoon, Squall, Heat Dome,
  Deep Freeze, Calm, or basics), rest sites can **chart the sky** to remove one,
  the Storm Caller shuffles Storms into your sky, and *Scatter Clouds* replaces
  the next forecast. (Special weathers like Dry Storm or Aurora are for later.)
- **D. Distilling**: every recipe brewed in a fight (by you or an enemy) can be
  offered as a card afterwards, in one of two forms picked at random: a
  **Flask** (the brew as a card) or an **Essence** (adds the recipe's elements
  to your cauldron). Both are generated from the recipe list: 2-element recipes
  cost 1, 3-element ones cost 2. To protect diversity:
  - Up to 2 of the 3 reward choices are distilled; **at least 1 is always a
    random card** from the normal pool.
  - A recipe already distilled into your deck is offered again with only a
    **25% chance** (no hard limit), so decks branch out instead of stacking one brew.
  - Enemy brews count, so different enemies lead to different options.
  - A simulation (60 auto-played runs, random reward picks) checks it: with
    distilling, distinct cards per card added went from 0.87 to 0.97, the
    similarity between two runs' decks from 0.14 to 0.06, and the number of
    different cards seen across runs from 22 to 61. A test fails if distilling
    ever makes decks less varied than random rewards alone. (After Milestone
    8's tougher enemies the random player dies sooner and adds fewer cards;
    the same measure now gives 0.98 → 0.99, 0.034 → 0.034 and 38 → 55
    different cards, and the test still passes.)
- Not built yet: **E (storm front)**, **F (elements as energy)**.

### 11.4 Recommendation

Build **A (Exposure)** first. It is small, it changes every turn, and it turns
the existing weather-element rule into a decision. Then **B (enemy
cauldrons)** and **C (the Sky Deck)**, which make the two pillars interact
with the enemies and the run. Then decide on **D (Distilling)** to replace
card rewards. Keep **E** for when the map needs more depth, and treat **F** as
a later experiment. Balancing (the old Milestone 7) should wait until these
are in, since they change the numbers.

---

## 12. Balance (Milestones 8 and 10)

### 12.1 How it was measured

Balancing by hand needs many runs, so the game plays itself:
- A **computer player** (`tests/helpers/smartplay.ts`) tries every card it can
  play, plays out the rest of the round on a copy of the fight, and picks what
  leaves it best off (its HP, the enemies' HP, Burn, Weak, what is in the
  cauldron…). It chooses Out or Cover the same way, rests when hurt, takes
  elites when healthy, and picks the best-looking card reward. It doesn't know
  where lightning will strike. It plays about as well as a strong player.
- **`npm run balance`** plays 200 runs with it and prints a report: win rate,
  where runs end, HP lost in each kind of fight, and how the weather behaved.
  It also plays 200 runs of random cards and random rewards, as a floor.
- A test (`tests/balance.test.ts`) plays 20 runs of each and fails if the
  computer player wins less than 20% or more than 80% of the three-act runs,
  or random play wins more than 5%, so later changes can't break the balance
  by accident.
- 200 runs can easily be 5 points off, so comparing two versions takes a
  thousand or more: `RUNS=1000 SEED=1001 npm run balance` plays more runs
  from another starting seed.

### 12.2 Targets and results

Before the balance pass the computer player won **100%** of runs, losing about
3 HP a fight: enemies hit too softly for a player who blocks well, and healing
brews let slow fights end with *more* HP than they started. The targets: a
strong player wins about 60%, random play never wins, easy fights cost a
few HP, hard fights about 10, elites about 20–30 and the boss about 35.

| | Before | After |
|---|---|---|
| Computer player wins | 100% | **59%** |
| Random play wins | – | **0%** |
| HP lost per fight | 2.5 | 12.4 |
| Easy fights (floors 1–3) | 0–2 HP | 1–9 HP |
| Hard fights | 0–5 HP | 4–14 HP |
| Elites | 2–10 HP | 20–28 HP |
| Boss | 6 HP, always won | 36 HP, won 72% of the time |

About half of the lost runs end at the boss, and most of the rest on floors 5–9.

What changed:
- Enemies hit harder (about 1.2–1.6×) and have a little more HP; elites and
  the boss more than the rest (see §5.3 for the numbers).
- Healing brews heal less: Tonic 5 → 2 (Block 5 → 7), Thaw 6 → 3, Downpour
  4 → 3 (Block 6 → 7).
- The **Frost Golem** no longer calls Snow: Snow kept the *player's* Block too,
  so the Golem could never hurt anyone. It now brews Ice Lance at you as well
  as Permafrost for itself.
- The **Snow Wolf** doesn't call Snow either; it hunts better in Snow when the
  sky brings it.
- Two-enemy fights pair a strong enemy with a weak one (a Drizzle Slime or a
  Spark Wisp), because two strong enemies together were much harder than
  anything else on the same floor.

### 12.3 The weather interval

The same 200 runs with every basic weather lasting 2, 3 or 4 turns:

| Interval | Won | Weathers seen per fight | Changes on schedule per fight |
|---|---|---|---|
| 2 turns | 59% | 3.4 | 1.9 |
| **3 turns** | 62% | 2.5 | 0.8 |
| 4 turns | 61% | 2.3 | 0.4 |

(Weathers are counted in fights before the boss, which changes the weather
every round anyway. These runs came before the last few enemy changes, so
their win rates are a little higher than the final 59%.)

Difficulty barely moves, so the interval is about feel. **3 turns stays**: the
sky changes in most fights and you see two or three weathers, but each one
lasts long enough to plan around and to play Attuned cards in it. At 2 the
weather flips almost every other turn; at 4 the schedule hardly matters,
because cards and enemies change the weather first.

### 12.4 What the numbers can't tell

A computer player can't say whether something is fun, readable or fair, and
people play differently (they'll lose more HP but may spot tricks it misses).
The next step is playtesting on real phones. If the game feels too hard, the
easiest levers are enemy damage in `src/data/enemies.ts`, the rest-site heal
(`REST_HEAL`) and gold rewards.

### 12.5 Three acts (Milestone 10)

With three acts, Act 1 is no longer the whole run, so it got a little easier
(Eye of the Storm 170 → 150 HP, Storm Roc 110 → 100 HP) and the player's max
HP went from 75 to 80. Acts 2 and 3 were tuned the same way as §12.1, with the
heuristic player playing whole runs (200 runs, `npm run balance`):

| | Result |
|---|---|
| Runs won by the heuristic player | 38% (random play: 0%) |
| Runs that clear Act 1 / Act 2 / Act 3 | 77% / 75% of those / 66% of those |
| Boss fights won | Eye of the Storm 88%, Frost Wyrm 90%, Heart of the Storm 80% |
| HP lost to each boss | about 28 / 38 / 38 |
| Elites | 87–100% won, 9–29 HP lost |
| Hardest normal fights | 91–94% won (Automaton + Wraith, Lava Lizard + Wraith, Sleet Sprites) |

Two lessons from the tuning:
- Enemies that call **Snow** made fights *easier*, because Snow keeps the
  player's Block too (the Frost Golem lost its Snow move for the same reason
  in §12.2). Act 2's cold enemies now **shatter** your Block, so Snow favours
  them instead. The first shatter hits were too strong (the Frost Wyrm won
  79% of fights *against* the player), so shattering attacks hit lighter.
- Two-enemy fights in Act 3 were the biggest killers (about 40% lost at
  first); lower Burn and Weak on the Ember Wraith and a little less HP fixed
  them.

The boss relics are close to each other: runs with the Philosopher's Stone won
63%, the Grand Grimoire, Sky Anchor and Bottomless Flask 55–56%, the Storm
Vow 46%.

### 12.6 Rare cards and more content (Milestone 10, part 2)

New content should add choices, not make runs easier or harder by accident.
Measuring that took more runs than before: the first 200-run report said the
heuristic player's wins fell from 38% to 28%, so both versions were played on
the same 2,000 seeds, and each new part was switched off, and on, by itself
(1,000 runs each).

| | Runs won |
|---|---|
| Before part 2 (v0.14.0), 2,000 runs | about 35% |
| Part 2, first version, 1,000 runs | about 29% |
| Part 2, tuned, 2,000 runs | about 32% (Act 1 cleared 75%, Act 2 52%) |

What each part did, switched on alone (1,000 runs, about ±2 points):
- **Rare cards** help the most (+4.5 points), mostly for Act 3: a deck with a
  rare in it is stronger for the rest of the run.
- The new **three-element recipes** cost 4 points and made Act 1 harder,
  where nothing else changed much. The biggest recipe always wins, so common
  cauldrons like 💧🪨🌬️ and 🔥🔥🪨 now made Tincture or Volcano *instead of* a
  two-element brew plus a kept element, and the first versions were weaker
  than that. Stronger versions (Volcano 12 fire and 3 Burn, Glacier 18 Block,
  Tincture 12 Block) are neutral. The two-weather-element recipes changed
  nothing.
- More **relics** and more **common cards** each cost 1–2 points: with bigger
  pools, the strongest old relics and cards come up less often. That is the
  price of variety; rares a little more often (8/14/20% by act), a potion
  with the Belt Pouch and small buffs to the weaker new commons make up most
  of it.
- The new **events** and **potions by act** changed nothing measurable.

The standard 200-run report after tuning: 33% of runs won (random play 0%);
the bosses are won 92% (Eye of the Storm), 84% (Frost Wyrm) and 82% (Heart of
the Storm) of the time. The Conductor and Sunbreak are the rares the
heuristic player takes most; Hoarfrost and Avalanche the least, since it
doesn't plan around Snow and Block. How strong the Lasting cards feel is a
question for playtesting.
