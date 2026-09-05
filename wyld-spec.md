# FIELDWORK — Design Document & Implementation Plan (v1)

**Working title:** Fieldwork
**Format:** Single-player, browser-based, real-time 3D creature-naturalist game
**Stack:** TypeScript + Vite + Three.js, no external art assets, no backend
**Audience for this document:** A coding agent with no prior context. Everything needed to build v1 is here. Read the whole document before writing any code.

---

## 0. How to read this document

- **Sections 1–3** are the vision and pillars. Read them to understand *why*; when a later detail is ambiguous, resolve it in favour of the pillars.
- **Sections 4–12** are the systems spec. These are the decisions. Implement them as written; numbers are starting values and are marked as tunable where appropriate.
- **Section 13** is content: the world, the creatures, the moves, the gates. It is data-driven; put it in JSON.
- **Sections 14–16** are architecture, tech, and UI.
- **Section 17** is the implementation plan: eight milestones, each with explicit verification checkpoints. Do them in order. Do not start a milestone until the previous one's checkpoints pass.
- **Section 18** lists what is explicitly out of scope and what latitude you have.

**Terminology note.** This game is inspired by the *feeling* of a well-known creature-collecting franchise but is not a clone of it and must not reference it. Do not use that franchise's terms anywhere in code, UI, comments, or data. Use: *creature*, *species*, *field guide*, *bond tag*, *practice spot*, *camp*, *party*, *roster*.

---

## 1. Vision

You are a naturalist dropped into a small wild region with one creature you already know well and a field guide that is almost empty. There are thirteen species out there. Your goal is to fill the guide.

Filling the guide is not a matter of walking around and bumping into things. Creatures live in specific places at specific times. You learn about them the way a birder does: you find tracks, you hear a call at dusk, you glimpse a shape on a ridge you can't reach yet. The guide fills itself in from what you observe, and the gaps in it tell you where to go next.

Some creatures are far stronger than anything you have. You will meet them early, get wrecked, and spend the middle of the game assembling the answer to them — which means finding the *right* creatures, taking them to practice spots, and teaching them moves that you design yourself. A creature's strength comes from the training you put into it, not from what species it is.

The game ends when the guide is complete. There are no credits; there is a full notebook.

---

## 2. Design pillars

Every implementation decision should be checked against these. If a feature request or shortcut violates one, don't do it.

1. **Discovery is deduction, not delivery.** The game never tells you where a creature is. It gives you evidence — tracks, calls, sightings, habitat — and you work it out. The guide does the bookkeeping automatically so the player spends their brain on *where to go*, not on data entry.

2. **Training is a craft.** Moves are designed by the player in a workshop, at a practice spot in the world, constrained by what the creature's body can do. Moves get stronger because they get used. The player's cleverness, not the species roll, determines how strong a creature becomes.

3. **Tags are the whole rules system.** Moves carry tags (Impact, Heat, Cut, Surge, Leap). Creatures have hides that resist or fold to those tags. Obstacles in the world declare which tags they need. Combat matchups and world gating both fall out of the same small vocabulary — there is no separate type chart and no separate puzzle system.

4. **Creatures are individuals.** Two members of the same species roll different temperaments and stats and want different move sets. Reshaping a creature into something it isn't is deliberately expensive; the smart play is to observe what you caught and build around it.

5. **Small and deep over wide and shallow.** Four biomes, thirteen species, a party of three. Every piece should matter.

---

## 3. The core loop

```
   ┌──────────────────────────────────────────────────────────────┐
   │                                                              │
   ▼                                                              │
 OBSERVE ──► PLAN ──► PREPARE ──► EXPEDITION ──► FIGHT/CAPTURE ───┘
 (guide       (which    (camp:      (travel,       (real-time,
  fills in    creature,  rest to     stealth,       call moves,
  from        which      phase,      approach,      tag & bond)
  evidence)   moves,     pick party, follow
              which      craft/      tracks)
              camp)      upgrade)
```

The player's goal is always "fill the next blank in the guide." Everything else — training, gating, sightings — exists to make that blank hard and satisfying to fill.

---

## 4. World & time

### 4.1 World structure

One contiguous heightmap terrain, roughly **800 × 800 world units** (1 unit ≈ 1 metre), containing four biomes arranged around a central forest. The player can walk from any biome to any adjacent biome; movement between some biomes is blocked by **gates** (§10) until the player has the right capability.

```
                    NORTH
          ┌───────────────────────┐
          │       VOLCANO         │  gate from forest: HEAT ≥ 4 (Thorn Pass)
          │  (crater at far north)│  inner gate to crater nest: SCALE (innate)
          ├───────────┬───────────┤
   WEST   │           │           │  EAST
          │  FOREST   │  DESERT   │  gate from forest: IMPACT ≥ 5 (Eastern Rockfall)
          │  (start)  │           │
          ├───────────┴───────────┤
          │     ARCHIPELAGO       │  gate from forest: SWIM (innate) — shore channels
          │  (islands, channels)  │  inter-island: SWIM
          └───────────────────────┘
                    SOUTH
```

Each biome is divided into **named regions** (3–5 per biome) used for sighting messages, guide habitat entries, and the map. Region names are data (§13.1).

### 4.2 Biome character

| Biome | Visual | Mechanical role |
|---|---|---|
| **Forest** (start) | Dense low-poly conifers/broadleaf, ferns, a pond/marsh in the south-west, a chasm and ridge in the north-east | Open tutorial biome. Cover for stealth. Contains the first practice spots, the amphibious species (SWIM key), and the first "wall" creature. From the starting camp the volcano is visible on the horizon. |
| **Archipelago** | 5–6 small islands, shallow turquoise channels, rock stacks, tide pools | Traversal. Every island crossing needs SWIM. Rewards having an amphibious creature. Home of a Surge-focused roster. |
| **Desert** | Dunes, salt flats, rock mesas, a tar pit that smoulders | Visibility. Long sight lines make stealth hard; night is the active time. Home of the Heat species (key to the volcano). |
| **Volcano** | Black rock, ash fields, glowing vents, a caldera at the far north | Endgame. Heat hazards. The apex creature's nest is on the crater rim, reachable only by SCALE. |

### 4.3 Time

- A full in-game day is **12 real minutes**, divided into four **phases** of 3 minutes each: **Dawn → Day → Dusk → Night**.
- Sun direction, sky colour, fog colour, and ambient intensity interpolate across phases. Night is dark but not unplayable (moonlight, higher fog).
- Every spawnable species has a set of **active phases**. Outside them it does not spawn.
- The current phase and a small progress arc are always shown in the HUD.
- Phase transitions fire an event (`phaseChanged`) that the spawn and sighting systems listen to.

### 4.4 Camps

Camps are fixed points in the world (§13.1). Walking within 6 m of an undiscovered camp discovers it (notification, added to map).

At a camp the player can:

- **Rest** — choose a phase (Dawn/Day/Dusk/Night). Time jumps to the *start* of the next occurrence of that phase. All party creatures heal fully and focus refills. The player wakes at this camp.
- **Manage party** — swap any of the 3 active party slots with any creature in the roster.
- **Upgrade moves** — spend a creature's XP on move upgrades or stat/temperament adjustments (§8). (Crafting *new* moves requires a practice spot, not a camp.)
- **Fast travel** — instantly move to any other discovered camp. Time does not advance.
- **Save** — autosave triggers on arrival and on any camp action.

**Why camps matter (design intent, preserve this):** the player can set the clock to any phase, but they wake at the camp. If a creature appears at the marsh at dusk and the nearest discovered camp is a 90-second walk away, the player must rest to Day and hike, arriving in the window. Discovering a camp *near* a habitat is a real reward because it puts that habitat inside a reachable time window. Fast travel is camp-to-camp only for the same reason.

There is **no resting outside camps** and **no waiting-in-place time skip**. Time advances only by real time or by resting.

### 4.5 Being driven off

If all three party creatures are downed, or the player is caught by a hostile creature with no active creature, the player is **driven off**: fade to black, wake at the last camp visited, time advanced by one phase, all creatures recovered. Nothing is lost. The encounter is still logged in the guide (any facts observed during the fight are kept).

---

## 5. Creatures

### 5.1 Species vs individual

A **species** (data, §13.2) defines:

- body plan (drives procedural visual and allowed move deliveries)
- hide type (drives tag resistances)
- tier (power band: 1, 2, or 3)
- base stat ranges (Vigor, Power, Speed, Focus)
- temperament weights
- allowed forces (which of Impact/Cut/Heat/Surge it can learn)
- innate traversal capabilities (SWIM, SCALE, or none)
- habitat rules: biome regions × active phases
- signature moves (the fixed moves wild individuals use)
- guide facts: tracks description, call description, silhouette, flavour hints
- rarity: `standing` (spawns by habitat rule) or `rare` (sighting-driven, §9)

An **individual** (runtime + save) is rolled from the species on spawn:

- stats rolled uniformly within species ranges
- temperament rolled from species weights
- for wild individuals: repertoire = species signature moves
- for owned individuals: repertoire = whatever was observed at capture (§7.5) plus anything crafted since; up to **3 equipped**, unlimited stored
- XP (owned only), adjustment counters (owned only), player-given name (owned only)

### 5.2 Stats

| Stat | Range (all tiers) | Effect |
|---|---|---|
| **Vigor** | 40–450 | Hit points. |
| **Power** | 2–10 | Damage multiplier: `0.6 + Power/10`. Also sets the magnitude bonus for traversal tags (§10). |
| **Speed** | 2–10 | Movement speed `3 + Speed × 0.6` m/s; windup multiplier `1.2 − Speed × 0.06`. |
| **Focus** | 20–100 | Energy pool. Moves cost focus (§7.3). Regenerates 4/s out of combat, 2/s in combat. |

Tier bands (species ranges live inside these):

| Tier | Vigor | Power | Speed | Focus |
|---|---|---|---|---|
| 1 | 40–80 | 2–4 | 3–7 | 30–50 |
| 2 | 120–200 | 4–7 | 3–7 | 40–70 |
| 3 | 350–450 | 8–10 | 4–6 | 80–100 |

**There is no species-level cap on owned creature growth.** A tier-1 creature that has been invested in heavily can exceed tier-2 wild stats. Tiers describe the *world*, not the player's ceiling.

### 5.3 Hide types

Each species has exactly one hide. Hides set damage multipliers per force tag.

| Hide | Weak to (×1.6) | Resists (×0.6) | Neutral (×1.0) |
|---|---|---|---|
| **Bark** | Heat | Cut | Impact, Surge |
| **Shell** | Impact | Cut | Heat, Surge |
| **Scale** | Surge | Heat | Impact, Cut |
| **Hide** (fur/skin) | Cut | Surge | Impact, Heat |
| **Stone** | Surge | Impact | Cut, Heat |

The hide type is a guide fact, revealed the first time any of the player's moves hits a member of that species. The full weak/resist line is revealed on the first hit with a weak force or a resisted force respectively (the guide shows "Takes heavy damage from Heat" / "Shrugs off Cut" as separate discoveries).

### 5.4 Temperament

Temperament is the single most important individual trait. It drives how the creature positions itself in combat (owned *and* wild) and how it behaves when it detects the player (wild only).

| Temperament | Combat positioning | Wild detection behaviour | Wild flee threshold |
|---|---|---|---|
| **Skittish** | Keeps ≥ 10 m from the enemy; retreats 4 m after being hit; prefers Bolt/Arc moves when equipped | Flees on detection; vision range 30 m | Flees at 25% HP |
| **Bold** | Closes to melee and holds within 3 m; ignores damage taken | Aggros on detection; vision 20 m | Never flees |
| **Steady** | Holds 5–7 m; moves only when a move requires it | Turns to face and holds ground; aggros if approached within 8 m; vision 20 m | Flees at 15% HP |
| **Erratic** | Strafes around enemy at 4–8 m, changes direction every 1.5–3 s | 50/50 flee or aggro on detection, re-rolled each detection; vision 20 m | Flees at 40% HP, 50% chance |

Owned creatures never flee; their temperament affects positioning only. Temperament is a guide fact per species ("Temperaments observed: Skittish, Steady"), revealed after 20 s of observing an individual moving or after any combat with it.

### 5.5 Body plans

Body plan determines the procedural visual and which move deliveries the species can learn. There are no imported models; each body plan is assembled from Three.js primitives (boxes, spheres, cylinders, capsules) with per-species scale, proportion, and palette parameters. Aim for readable silhouettes, not realism. Each body plan needs three animation states: idle (breathing bob), locomotion (leg/body cycle), and a generic "execute" lunge/recoil used for all moves. Use simple procedural animation (sin-driven transforms), not keyframes.

| Body plan | Primitive sketch | Allowed deliveries | Innate |
|---|---|---|---|
| **Heavy quadruped** | Wide box torso, four thick cylinder legs, boxy head, optional horns | Strike, Lunge, Sweep | — |
| **Light quadruped** | Narrow capsule torso, thin legs, long tail, pointed head | Strike, Lunge, Bolt | — |
| **Avian** | Small body, two wing planes that flap, beak cone. Hovers 2–4 m above ground; lands to idle | Bolt, Arc, Lunge | Ignores LEAP gates (does not carry the player) |
| **Amphibious** | Low flat body, splayed legs, fin ridge; swims when in water volumes | Strike, Bolt, Sweep | **SWIM** — carries the player across water gates |
| **Serpentine** | Chain of 8–10 spheres following the head with lag | Strike, Lunge, Sweep, Bolt | **SWIM** if species flags aquatic |
| **Shelled** | Dome torso, stubby legs, retractable head | Strike, Sweep | — |
| **Crawler** | Low segmented body, six legs, mandibles | Strike, Sweep, Arc | **SCALE** — carries the player up cliff gates |
| **Large biped** | Tall torso, two heavy legs, two arms, big head. Tier-3 only | Strike, Lunge, Sweep, Arc, Bolt | — |

---

## 6. The field guide

The guide is the game's quest log, map, bestiary, and win condition. It is a **notebook object** that is serialised independently of the rest of the save so that a future version can sync notebooks between players. Design it as pure data plus a renderer.

### 6.1 Facts

Every species has a fixed set of **fact slots**. The guide is a map from `(speciesId, factSlot) → discovered value(s)`. There is no free-text entry in v1.

| Fact slot | How it is discovered | Cardinality |
|---|---|---|
| `tracks` | Player within 6 m of a tracks decal for that species | once |
| `call` | Player within 25 m of a wild individual during its active phase when it vocalises (every 10–20 s), *or* within earshot when it aggros | once |
| `silhouette` + `name` (identification) | Wild individual inside camera frustum, within 40 m, unobstructed line of sight, for 1.5 s cumulative | once |
| `habitat` | On identification: the region the individual was seen in is added | many (one per region) |
| `phase` | On identification and on every subsequent sighting: current phase is added | many (one per phase) |
| `sighting` | Every identification: `{region, position, phase, day}` appended and pinned on the map | many (cap 20; oldest dropped) |
| `hide` | First hit landed by a player move on that species | once |
| `weakness` | First hit landed with a force the hide is weak to | once |
| `resistance` | First hit landed with a force the hide resists | once |
| `moves` | Each distinct signature move a wild individual is observed executing within 40 m and line of sight | many (one per signature move) |
| `temperament` | 20 s cumulative observation of an individual moving, or any combat with it | many (one per temperament) |
| `captured` | Bonding a member of the species | once |
| `rumour` | Sighting event announced (§9) whether or not the player reached it | many (cap 10) |

### 6.2 Stub pages and merging

Before a species is identified, its discovered facts live in **stub pages**. Each stub is a single pre-identification fact with its own page: "Unknown tracks — three-toed, dragging tail — Forest (Pond Hollow)". Tracks and call for the same species are **separate stubs**; the player does not get told they belong together.

On identification, all stubs for that species **merge** into the named page with a notification: "Identified: Mirefin. Two earlier notes attached." This is a deliberate reward moment; give it a small animation in the guide UI (stubs slide into the page).

### 6.3 Hints

Every fact has a **hint string** in species data — one sentence of flavour that says slightly more than the raw observation. Examples: tracks hint "The prints are fresh and lead toward water."; call hint "A dry rasping, repeated three times, always from low cover." Hints are shown in the discovery toast and on the guide page. They are the game's only nudge and must never name a region, phase, or species outright.

### 6.4 Guide UI

A full-screen book overlay (key `G`) with tabs:

- **Index** — one line per page: identified species by name with a completion fraction (e.g. `7/11`), stubs listed under "Unidentified". Sorted: incomplete identified first, then stubs, then complete.
- **Species page** — silhouette (rendered from the procedural model as a dark shape), name, all discovered facts, blanks shown as `______` lines so the player can see what is missing. Sightings listed with region and phase. Hide/weakness/resistance lines. Moves observed, each with its delivery/force badges. Temperaments observed.
- **Map** (also key `M`) — top-down stylised map of the whole world, fog-of-war revealed by exploration (grid cells of 20 m, revealed within 40 m of the player). Shows discovered camps, discovered practice spots, discovered gates (with their requirement once inspected), sighting pins (colour per species), and the active sighting event's region highlighted (not pinned). Habitat regions for a species highlight when that species' page is selected.
- **Fragments** — the list of rumours and unconfirmed sightings (§9) that have not yet resolved into a species page.

### 6.5 Completion and win

A species page is **complete** when all of these are true: identified; tracks; call; hide; weakness; resistance; ≥ 1 habitat region; ≥ 1 phase; every signature move observed; ≥ 1 temperament; captured.

Guide completion = complete pages / 13. Shown on the Index tab.

At 100%, the guide's final page becomes readable: a short in-fiction text (write 3–4 sentences in the voice of the naturalist closing the book) and a stamp reading **Complete**. No credits, no menu change; the player can keep playing. Autosave with a `completedAt` timestamp.

### 6.6 Starting state of the guide

The player begins with one owned creature (a Loamox, §13.2) and its page **complete** — a worked example of what a finished page looks like, including two sightings near the starting camp attributed to "before the journal began." The Index therefore starts at 1/13.

Within the opening beat (§13.6) a second page is created for the apex species with only silhouette, one sighting, and one phase. Every other page starts non-existent.

---

## 7. Combat

### 7.1 Overview

Real-time, third-person. The player moves freely and is never directly damaged in v1 (see §4.5 for the driven-off rule). The player's **active creature** positions itself autonomously according to its temperament and executes moves the player calls with keys **1 / 2 / 3**. The player can swap the active creature among the party with **Tab** (2 s swap delay during which no creature is active; the incoming creature spawns at the player's position).

Wild creatures use their signature moves with their own AI (§7.6).

### 7.2 Encounter state

An **encounter** begins when either: the player's active creature executes a move targeting a wild creature; or a wild creature aggros (§7.7). It ends when the wild creature is downed-and-tagged, downed-and-escaped, fled out of 60 m, or the player is driven off.

During an encounter: combat music/ambience layer, HUD shows the target's HP bar (revealed as a bar only; exact numbers never shown) and name if identified, otherwise "Unknown creature".

### 7.3 Moves

A move is:

```ts
interface Move {
  id: string;
  name: string;              // player-named for crafted moves; fixed for signature moves
  delivery: 'Strike' | 'Lunge' | 'Bolt' | 'Arc' | 'Sweep';
  force: 'Impact' | 'Cut' | 'Heat' | 'Surge';
  power: number;             // 1–10
  speed: number;             // 1–5
  cooldownMult: number;      // 1.0 at creation; reduced by upgrades, min 0.5
  rangeMult: number;         // 1.0 at creation; raised by upgrades, max 1.6
  modifiers: Modifier[];     // max 2
  familiarity: number;       // times used (hit or miss)
  upgradeLevel: number;      // 0 at creation
}
```

**Delivery** sets range, area, base windup, base cooldown, and focus cost:

| Delivery | Range | Area | Base windup | Base cooldown | Focus | Notes |
|---|---|---|---|---|---|---|
| **Strike** | 2.5 m | single target | 0.6 s | 2.0 s | 6 | Melee. Creature must be in range; if not, it moves into range first, then executes. |
| **Lunge** | 8 m | single target | 0.8 s | 4.0 s | 10 | Creature dashes from its current position to the target, hits on arrival. Grants **LEAP** tag with magnitude = power. |
| **Bolt** | 20 m | single target | 0.9 s | 3.0 s | 8 | Projectile, 25 m/s, straight line; can miss a moving target. |
| **Arc** | 15 m | 3 m radius | 1.2 s | 6.0 s | 12 | Lobbed projectile; lands where the target *was* at launch; hits everything in radius. |
| **Sweep** | 4 m | 120° cone | 1.0 s | 5.0 s | 10 | Hits everything in the cone in front of the creature. |

**Force** is the damage type and the tag used for hide matchups and world gates.

**Windup** actual = `baseWindup × (1.2 − speedStat × 0.06) × (1 − moveSpeed × 0.1)`. Clamp to ≥ 0.25 s. During windup the creature is committed; a hit on it during windup does not cancel (v1 keeps this simple).

**Modifiers** (max 2 per move; each occupies an upgrade level, see §8.2):

| Modifier | Effect |
|---|---|
| **Follow-through** | Target knocked back 3 m along the hit direction; 0.5 s stagger. |
| **Lingering** | Force-dependent after-effect for 3 s: Heat → 3 dmg/s burn; Surge → −40% target speed; Cut → 2 dmg/s bleed; Impact → next hit on target within 3 s ×1.25. |
| **Quickened** | Windup −25%. |
| **Reaching** | `rangeMult += 0.3`. |
| **Heavy** | `power += 2`, `cooldownMult += 0.5`. |

### 7.4 Damage

```
damage = power × 5 × (0.6 + attacker.Power / 10) × hideMultiplier(defender.hide, move.force) × ambushMultiplier
```

- `hideMultiplier` from §5.3.
- `ambushMultiplier` = 1.5 on the first hit of an encounter if the wild creature had not detected the player when the move was called; 1.0 otherwise.
- Round to integer, minimum 1.

Worked check (use these as unit test fixtures): Loamox (Power 3) using Strike/Impact power 3 vs Bramblehog (Bark, Vigor 60): `3×5×0.9×1.0 = 13.5 → 14`. Five hits to down. Same Loamox vs Antlerback (Bark, Vigor 200): 14 per hit → 15 hits, while Antlerback's power-5 Impact vs Loamox Vigor 70 does `5×5×(0.6+0.55)×1.0 = 28.75 → 29` — three hits. Antlerback is a wall for the starter. Emberjack (Power 4) with an upgraded Heat move at power 6 vs Antlerback: `6×5×1.0×1.6 = 48` → five hits. The wall opens once you have the Heat species and have trained it.

### 7.5 Downed, bonding, capture

- At 0 HP a creature is **downed**: it collapses, cannot act, and is invulnerable.
- **Wild downed:** an 8-second **bond window** opens. The player must be within 4 m and hold **E** for 2 seconds to apply a **bond tag**. Bond tags are unlimited (they are a narrative device, not an item). Bonding always succeeds. If the window closes untagged, the creature recovers to 30% HP and flees (despawns at 60 m); the encounter is still logged.
- **Owned downed:** auto-swaps to the next non-downed party member with the 2 s delay. If none, driven off (§4.5). Downed owned creatures recover at any camp rest.
- **On capture:** the new individual's repertoire is exactly the set of that species' signature moves the player has **observed** (guide fact `moves`), minimum one — if none observed, it gets the species' first signature move. Its stats and temperament are those it was rolled with. It is added to the roster (not the party) and the player is prompted to name it. Guide fact `captured` set.

**Design intent to preserve:** observation pays out in capability. Watch a creature fight three times and see all four of its moves before you capture it, and you get all four. Rush it and you get one.

### 7.6 Wild creature combat AI

Each tick, a wild creature in an encounter:

1. Positions per temperament (§5.4) relative to the player's active creature (target). If the player has no active creature (swap delay), target the player and, on reaching 2 m, trigger driven-off if the party is fully downed; otherwise wait.
2. Checks flee threshold; if met, exits combat and flees directly away from the player at full speed.
3. Otherwise picks a move: from its signature moves that are off cooldown and affordable, prefer the one whose range best matches current distance; ties broken randomly. If none affordable, hold position 1 s.
4. Executes: face target, windup, resolve.

### 7.7 Detection, stealth, ambush

Wild creatures have a **vision cone** (120°, range by temperament) and **hearing** radius by player movement mode: sprinting 15 m, walking 8 m, crouching 3 m. Standing still is silent. Line-of-sight is checked against terrain and large props (trees, rocks) with a raycast.

Detection is a meter (0–100) that fills at 60/s while the player is seen or heard and drains at 30/s otherwise. At 100 the creature reacts per temperament. A small eye icon over the creature shows the meter to the player when > 0.

**Ambush:** if the player's creature executes a move on a wild creature whose detection meter is < 100, the first hit gets ×1.5 and the wild creature is staggered for 1.5 s before its AI begins. Approaching from behind, crouched, using cover, at the right phase, is the intended opener — and the guide's temperament and habitat facts are what let the player plan it.

### 7.8 Focus

Moves cost focus. A creature with insufficient focus cannot execute (the slot greys out). Regen is 2/s in combat. This prevents spamming the highest-power move and makes low-cost Strikes worth keeping.

---

## 8. Training & progression

### 8.1 XP

XP is **per owned creature**. Earned by:

| Event | XP |
|---|---|
| Landing a hit | `1 × target tier` |
| Downing a wild creature | `15 × target tier` |
| Bonding (capturing) — awarded to the creature that landed the downing hit | `+10 × target tier` |
| Performing a traversal at a gate (the carrying/leaping creature) | 2 |
| Completing a practice-spot craft | 5 |

### 8.2 Move upgrades (at camps)

A move can be upgraded one level at a time. Level `n` (starting at 1) costs `10 × n` XP and requires `familiarity ≥ 5 × n` — the move must have been *used* at least that many times. Each level the player picks **one** of:

- `power += 1` (max 10)
- `speed += 1` (max 5)
- `cooldownMult −= 0.1` (min 0.5)
- `rangeMult += 0.15` (max 1.6)
- add a modifier (max 2 total; only available from level 2)

Design intent: "moves get stronger because you've used them." The familiarity gate is what makes that literal. Do not remove it.

### 8.3 Crafting new moves (at practice spots)

A **practice spot** is a world location with a **target** object. Standing at a spot with an active creature and pressing E opens the **Workshop** for that creature.

The Workshop is a builder UI:

1. Choose **delivery** — filtered to those allowed by the creature's body plan **and** by the spot's target.
2. Choose **force** — filtered to those allowed by the species **and** by the spot's target.
3. Set **power** (1–4 at creation; higher power comes only from upgrades) and **speed** (1–2 at creation).
4. Name it.
5. Confirm: costs **20 XP**. The creature plays a short "practice" animation against the target (3 s, target reacts — boulder cracks, brazier flares, water splashes). Move is added to the repertoire at `upgradeLevel 0, familiarity 0`.

Practice spot targets:

| Target | Allowed deliveries | Allowed forces | Found in |
|---|---|---|---|
| **Boulder** | Strike, Lunge, Sweep | Impact, Cut | Forest, Archipelago, Volcano |
| **Log course** (row of standing logs / posts) | Lunge, Bolt, Arc | Impact, Cut | Forest, Desert |
| **Spring / tide pool** | any | Surge | Forest (pond), Archipelago |
| **Ember vent** (smouldering pit) | any | Heat | Desert (tar pit), Volcano |

Design intent: learning a new move is itself a small expedition. Discovering an Ember vent is what makes a Heat move possible, and the Heat species live in the desert — so getting a Heat move means going there, catching one, and finding a vent. Do not add an "anywhere" crafting option.

### 8.4 Adjusting the individual (at camps)

The player can spend XP to alter a creature's base stats or temperament. This is intentionally expensive and escalating so that the dominant strategy is to build around what was caught.

- **Stat +1** (any of Vigor +10, Power +1, Speed +1, Focus +5): cost `40 × (k + 1)` where `k` = total stat adjustments already made on this creature. So 40, 80, 120, 160…
- **Temperament shift** one step along `Skittish ↔ Steady ↔ Bold` (Erratic can shift to Steady only): first shift 80 XP, second 200 XP, no third.

For comparison: a typical tier-1 fight yields ~20–30 XP. Five move upgrade levels cost 150. Two stat points cost 120. Reshaping a creature is 3–4× the price of making its moves excellent.

### 8.5 Repertoire and equipping

Each owned creature has an unlimited **repertoire** of known moves and **3 equipped slots** mapped to keys 1/2/3. Equipping is done at camps. Signature moves acquired at capture cannot be crafted but can be upgraded like any other move.

---

## 9. Sightings, rumours, and rare species

### 9.1 Standing species

Ten of the thirteen species are `standing`: they spawn by habitat rule. Each region lists which species can spawn there and at what phases; the spawn system (§14.3) maintains 1–3 individuals per eligible region per phase, spawning out of the player's view (> 60 m or behind occlusion) and despawning when the phase changes and they are > 80 m away.

### 9.2 Rare species

Three species are `rare`: **Kelpmaw**, **Glasswing**, and the apex **Pyreclaw**. Rare species have habitat rules like everyone else but a base spawn weight of **zero**. They appear through two routes:

**A. Sighting events.** At each phase change, if no sighting is active, roll 35%. On success pick a species (rares weighted ×3, standing ×1), pick a valid region for it at the new phase, and create a **sighting**: a guaranteed spawn in that region for the duration of one phase (3 minutes). The player is notified: *"A commotion to the south-east — something in the Salt Flats."* The message gives region name and an 8-point compass bearing from the player, never a pin. The guide's Fragments tab records a **rumour**: `{species: hidden, region, phase, day}`. If the player identifies the creature during the event, the rumour resolves into that species' page as a sighting. If the event expires unresolved, the rumour stays as *"Unconfirmed: something in the Salt Flats at Dusk, day 4."*

**B. Attraction.** For a rare species: if the player is present in one of its habitat regions during one of its active phases, and the guide holds ≥ 1 fragment (rumour or sighting) that matches that region+phase, the species spawns with 10% probability at the start of the phase — and is **guaranteed** if the player remains in the region for the full phase (tracked as a per-species "vigil" counter).

Design intent: missing a sighting is not a failure; it is how you get the first clue. The fragment tells you *where and when*, and standing vigil there is the birder's payoff.

### 9.3 The apex

Pyreclaw is rare with a single habitat region (Crater Rim) and phase (Night). Additionally, it is **scripted to be visible** in the opening beat (§13.6) and again at Night from the Volcano's lower ash fields as a distant silhouette on the rim (a non-interactive instance at the rim position, rendered when the player is in the Ash Fields region at Night). Reaching it requires the SCALE gate. It is the only species whose page can reach 100% only at the very end.

---

## 10. Tags, gates, and traversal

### 10.1 Tag vocabulary

| Tag | Source | Used for |
|---|---|---|
| **Impact** | move force | damage type; breaks rock gates |
| **Cut** | move force | damage type |
| **Heat** | move force | damage type; burns thorn/vine gates |
| **Surge** | move force | damage type |
| **Leap** | any Lunge move; magnitude = move power (after upgrades) | crosses chasm gates |
| **Swim** | innate (Amphibious body plan; aquatic Serpentine) | crosses water gates |
| **Scale** | innate (Crawler body plan) | crosses cliff gates |

A **party's capability** for a tag is the maximum magnitude any equipped move on any party creature provides (Impact/Heat/Leap), or presence of any party creature with the innate (Swim/Scale). Owned creatures do not need to be the *active* one; being in the party of three is enough.

### 10.2 Gates

A gate is a world object with a `requirement: {tag, magnitude}` and a `passedState`. Walking within 5 m shows a prompt: *"Rockfall — needs Impact 5. Your party: Impact 3."* (requirement is revealed on first inspection and logged on the map). If the party meets it, pressing E plays a 3-second traversal: the qualifying creature performs (boulder shatters / thorns burn / creature carries the player across water / up the cliff / leaps the chasm with the player), the player and party are placed on the far side. Destroyed gates (rock, thorns) stay destroyed. Traversal gates (water, cliff, chasm) can be re-crossed freely in either direction from then on (the crossing is remembered; the animation replays).

### 10.3 Gate list

| Gate | Location | Requirement | Unlocks |
|---|---|---|---|
| Shore Channels (×3) | Forest south shore ↔ first island; between islands | Swim | Archipelago |
| Eastern Rockfall | Forest ↔ Desert pass | Impact 5 | Desert |
| Thorn Pass | Forest north ↔ Volcano | Heat 4 | Volcano |
| Crater Ridge | Volcano ash fields ↔ Crater Rim | Scale | Apex nest, Rim Camp |
| Fern Chasm | Forest north-east | Leap 3 | Ridge Camp (overlooks volcano), log course |
| Mesa Gap | Desert | Leap 5 | Mesa Camp, vantage over Salt Flats |
| Sea Cave Wall | Archipelago, largest island | Impact 7 | Grotto Camp, Kelpmaw habitat interior |

Intended progression: Forest → (Mirefin gives Swim) → Archipelago **or** (Impact 5 from a drilled Loamox/Bramblehog) → Desert → (Emberjack + Ember vent gives Heat) → Volcano → (Ashcrawl gives Scale) → Crater Rim → Pyreclaw. Archipelago and Desert are interchangeable in order; Volcano requires Desert; the apex requires Volcano.

---

## 11. Player

- Third-person humanoid (capsule + head sphere + simple limbs), 1.8 m tall.
- **Move** WASD; **sprint** Shift (6 m/s vs walk 3.5 m/s vs crouch 1.8 m/s); **crouch** C toggle; **interact** E; **swap creature** Tab; **moves** 1/2/3; **guide** G; **map** M; **pause** Esc; **debug console** backtick.
- Camera: orbit follow, mouse look via pointer lock (click canvas to lock, Esc unlocks), 4–8 m distance with collision pull-in against terrain.
- Player has no HP (§4.5). Player cannot swim (water deeper than 0.6 m blocks movement) or climb (slopes > 45° block). Those are what gates and creatures are for.
- The active creature follows the player at 3–5 m when not in combat, using the same temperament-flavoured positioning (Skittish trails further, Bold walks ahead).

---

## 12. Onboarding

There is no tutorial sequence. Onboarding is done by the starting state:

1. The player wakes at **Hollow Camp** (forest) at Dawn with **one owned creature**: a Loamox named *Barrow*, Steady, Vigor 70, Power 3, Speed 4, Focus 40, with two crafted moves: **Headbutt** (Strike/Impact, power 3, speed 1) and **Charge** (Lunge/Impact, power 2, speed 1). Barrow's page in the guide is complete. Two of its sightings are placed near Hollow Camp.
2. A one-time contextual prompt overlay shows the controls for 8 seconds.
3. Within 30 m of the camp along the obvious path there are **Bramblehog tracks**, a **Boulder practice spot**, and a view north-east across **Fern Chasm** where the opening beat plays (§13.6).

Everything after that is the player's problem.

---

## 13. Content

All of this lives in `/src/data/*.json` (or `.ts` modules exporting typed constants). Nothing in this section is hard-coded in systems.

### 13.1 World points

Coordinates are approximate and expressed as `(x, z)` in world units with origin at the world centre; y comes from the terrain. Adjust to fit the generated terrain, but preserve relative placement and walking distances (±20%).

**Regions** (used by spawn rules, sightings, guide habitat):

| Biome | Region | Approx. centre | Notes |
|---|---|---|---|
| Forest | Hollow | (−150, 50) | start; Hollow Camp |
| Forest | Pond Hollow | (−220, 160) | marsh/pond; Mirefin; Spring practice spot |
| Forest | Deep Wood | (−80, −60) | dense; Antlerback |
| Forest | Fern Chasm | (−40, −180) | chasm; Ridge Camp beyond |
| Forest | South Shore | (−120, 260) | edge of archipelago; first Shore Channel |
| Archipelago | Near Island | (−100, 340) | Tidewhelk; Tide pool spot; Shore Camp |
| Archipelago | Stack Island | (40, 380) | Saltwing; Boulder spot |
| Archipelago | Long Island | (160, 330) | Sea Cave Wall → Grotto Camp; Kelpmaw interior |
| Archipelago | Channels | (0, 300) | deep water between islands; Kelpmaw open water at Night |
| Desert | Eastern Pass | (60, 20) | Eastern Rockfall gate |
| Desert | Dunes | (200, 60) | Emberjack; Dune Camp |
| Desert | Salt Flats | (300, −60) | Glasswing (rare); open, no cover |
| Desert | Mesa | (250, −180) | Dunecask; Mesa Gap → Mesa Camp; Log course |
| Desert | Tar Pit | (160, 140) | Ember vent practice spot |
| Volcano | Thorn Pass | (−60, −260) | Thorn Pass gate |
| Volcano | Ash Fields | (−40, −320) | Ashcrawl; Ash Camp; Boulder spot |
| Volcano | Vents | (20, −360) | Ashcrawl; Ember vent spot; heat hazard zones |
| Volcano | Crater Rim | (0, −390) | Pyreclaw nest; Rim Camp (after Crater Ridge gate) |

**Camps** (8): Hollow Camp (start), Ridge Camp (Forest, beyond Fern Chasm — Leap 3), Shore Camp (Near Island), Grotto Camp (Long Island, behind Sea Cave Wall — Impact 7), Dune Camp, Mesa Camp (beyond Mesa Gap — Leap 5), Ash Camp, Rim Camp (beyond Crater Ridge — Scale).

**Practice spots** (8): Boulder ×3 (Hollow, Stack Island, Ash Fields); Log course ×2 (Fern Chasm far side, Mesa); Spring/Tide pool ×2 (Pond Hollow, Near Island); Ember vent ×2 (Tar Pit, Vents). *(That is 9; drop the Vents ember vent to 8 if you want exact parity — either is fine.)*

**Gates:** as §10.3.

**Tracks decals:** each standing species has 4–8 tracks decal positions in its habitat regions, placed on paths between cover and water/food props. Tracks are always present (they do not depend on phase) so that a daytime player can find evidence of a nocturnal creature. Each decal is a ground-aligned plane with a procedurally drawn canvas texture (footprint pattern per species, in species data as a simple stamp descriptor: `{toes: 3, drag: true, stride: 0.8}`).

**Heat hazard zones** (Volcano, Vents region): 4–6 circular areas that deal 4 dmg/s to any creature inside unless its hide is Scale or Stone. Player is not damaged but the active creature will path around them.

### 13.2 Species

Thirteen species. Ranges are inclusive. Temperament weights sum to 1. "Signature moves" are fixed builds used by wild individuals and inherited on capture if observed.

#### Forest

**1. Loamox** — *standing, tier 1, Heavy quadruped, hide: Hide*
- Vigor 55–75, Power 2–4, Speed 3–5, Focus 35–45
- Temperament: Steady 0.6, Bold 0.3, Skittish 0.1
- Forces: Impact
- Habitat: Hollow, Deep Wood @ Day, Dusk
- Tracks: broad four-toed, deep, stride 1.0. Hint: "Heavy going — whatever made these doesn't mind being seen."
- Call: low huff-huff. Hint: "Slow, low breaths from the undergrowth."
- Signature: **Shove** (Strike/Impact p3 s1), **Trample** (Sweep/Impact p2 s1)
- Palette: dun brown, cream belly. Boxy head, short horns.

**2. Bramblehog** — *standing, tier 1, Light quadruped, hide: Bark*
- Vigor 40–60, Power 2–3, Speed 5–7, Focus 30–40
- Temperament: Skittish 0.5, Steady 0.3, Erratic 0.2
- Forces: Impact, Cut
- Habitat: Hollow, Pond Hollow @ Dawn, Dusk
- Tracks: paired small prints with a drag line, stride 0.5. Hint: "Small, quick, and dragging something behind it."
- Call: rasping chitter ×3. Hint: "A dry rasp, always from low cover, always at the edges of the day."
- Signature: **Quill Jab** (Strike/Cut p2 s2), **Tumble** (Lunge/Impact p2 s2)
- Palette: bramble green-brown with darker quills (thin cones on back).

**3. Thornwren** — *standing, tier 1, Avian, hide: Hide*
- Vigor 40–50, Power 2–3, Speed 6–7, Focus 40–50
- Temperament: Skittish 0.7, Erratic 0.3
- Forces: Cut
- Habitat: Hollow, Deep Wood, Fern Chasm @ Dawn
- Tracks: none (avian) — instead a **feather** decal counts as the `tracks` fact. Hint: "A barbed feather. It was here, briefly, and left."
- Call: rising two-note whistle. Hint: "Two notes climbing, from high up, only in the first light."
- Signature: **Needle** (Bolt/Cut p2 s3), **Dive** (Lunge/Cut p3 s2)
- Palette: slate blue, rust throat. Teaches stealth — near-impossible to approach without cover and crouch.

**4. Mirefin** — *standing, tier 1, Amphibious, hide: Scale — innate SWIM*
- Vigor 50–70, Power 2–4, Speed 3–5, Focus 40–50
- Temperament: Steady 0.5, Skittish 0.3, Bold 0.2
- Forces: Surge
- Habitat: Pond Hollow, South Shore @ Dusk, Night
- Tracks: three-toed webbed, tail drag, stride 0.6, always near water. Hint: "The prints are fresh and lead toward water."
- Call: bubbling croak. Hint: "A wet, bubbling call from the reeds after the light goes."
- Signature: **Spit** (Bolt/Surge p2 s2), **Slap** (Strike/Surge p3 s1)
- Palette: mottled olive, pale throat, fin ridge. **The Swim key.**

**5. Antlerback** — *standing, tier 2, Heavy quadruped, hide: Bark*
- Vigor 160–200, Power 4–6, Speed 4–5, Focus 50–60
- Temperament: Steady 0.6, Bold 0.4
- Forces: Impact, Cut
- Habitat: Deep Wood @ Day
- Tracks: cloven, very large, stride 1.4. Hint: "Cloven and wide — you could fit your hand in one."
- Call: deep bark-bellow. Hint: "One long bellow at midday, from deep in the wood, and the birds go quiet."
- Signature: **Gore** (Strike/Cut p5 s1), **Bull Rush** (Lunge/Impact p5 s1), **Rake** (Sweep/Cut p4 s1)
- Palette: bark-grey with moss patches, antlers as branching cylinders. **The forest wall.** Weak to Heat → the reason to go to the desert.

#### Archipelago

**6. Tidewhelk** — *standing, tier 1, Shelled, hide: Shell*
- Vigor 60–80, Power 2–3, Speed 3–4, Focus 30–40
- Temperament: Steady 0.8, Bold 0.2
- Forces: Surge, Impact
- Habitat: Near Island, South Shore @ Dawn, Day, Dusk, Night (any)
- Tracks: a single smooth furrow, stride n/a. Hint: "Something dragged its whole weight along the sand."
- Call: hollow knock. Hint: "A knock like a stone on a shell, at the waterline."
- Signature: **Jet** (Strike/Surge p3 s1), **Shell Spin** (Sweep/Impact p2 s1)
- Palette: bone-white shell with blue-grey body. Easy first capture in the archipelago; weak to Impact.

**7. Saltwing** — *standing, tier 2, Avian, hide: Hide*
- Vigor 120–150, Power 4–5, Speed 6–7, Focus 50–60
- Temperament: Erratic 0.6, Skittish 0.4
- Forces: Cut
- Habitat: Stack Island, Long Island @ Day
- Tracks: feather decal (white, long). Hint: "A long white feather stiff with salt."
- Call: harsh shriek. Hint: "A shriek over the stacks in full sun."
- Signature: **Gale Cut** (Bolt/Cut p4 s3), **Stoop** (Lunge/Cut p5 s2), **Wingslash** (Arc/Cut p3 s2)
- Palette: white and charcoal.

**8. Kelpmaw** — *rare, tier 2, Serpentine (aquatic), hide: Scale — innate SWIM*
- Vigor 150–190, Power 5–7, Speed 5–6, Focus 60–70
- Temperament: Bold 0.5, Erratic 0.5
- Forces: Surge, Cut
- Habitat: Channels @ Night; Long Island (grotto interior, behind Sea Cave Wall) @ Night
- Tracks: none in the open; inside the grotto, a wet coil-mark decal. Hint: "A wide wet coil on the cave floor, still glistening."
- Call: low resonant moan. Hint: "A moan from under the water that you feel more than hear."
- Signature: **Undertow** (Sweep/Surge p5 s1), **Fang** (Strike/Cut p6 s2), **Waterspout** (Arc/Surge p4 s1)
- Palette: deep green-black, luminous pale underside. The **second Swim** creature and the strongest Surge user — the intended tool against Pyreclaw.

#### Desert

**9. Emberjack** — *standing, tier 1, Light quadruped, hide: Hide*
- Vigor 45–65, Power 3–4, Speed 6–7, Focus 40–50
- Temperament: Skittish 0.5, Erratic 0.4, Steady 0.1
- Forces: Heat, Cut
- Habitat: Dunes, Salt Flats @ Night, Dawn
- Tracks: small four-toed, light, stride 0.7, often scorched at the edges. Hint: "Light prints with singed edges. It's warmer than the sand."
- Call: yip-yip, high. Hint: "Two sharp yips carried a long way over cold sand."
- Signature: **Cinder Bite** (Strike/Heat p3 s2), **Ember Bolt** (Bolt/Heat p2 s2)
- Palette: rust-orange, black ear tips, glowing throat. **The Heat key.**

**10. Dunecask** — *standing, tier 2, Shelled, hide: Stone*
- Vigor 170–200, Power 5–7, Speed 3–4, Focus 40–50
- Temperament: Bold 0.6, Steady 0.4
- Forces: Impact
- Habitat: Mesa, Dunes @ Day
- Tracks: deep round pads, stride 1.2. Hint: "Round and deep — it moves like it has all day."
- Call: grinding rumble. Hint: "A grinding rumble from the rocks in the heat of the day."
- Signature: **Boulder Butt** (Strike/Impact p6 s1), **Quake** (Sweep/Impact p5 s1)
- Palette: sandstone with darker plates. Weak to Surge — brings Mirefin back into play in the mid-game.

**11. Glasswing** — *rare, tier 2, Avian, hide: Shell*
- Vigor 120–140, Power 5–6, Speed 7–8, Focus 60–70
- Temperament: Skittish 0.6, Erratic 0.4
- Forces: Heat, Cut
- Habitat: Salt Flats @ Dusk
- Tracks: a glassy shard decal. Hint: "A shard of something like glass, still warm, on the salt."
- Call: crystalline chime. Hint: "A chime like struck glass, at the edge of hearing, as the sun goes down."
- Signature: **Shard Rain** (Arc/Cut p4 s2), **Flare** (Bolt/Heat p5 s3), **Glide Cut** (Lunge/Cut p4 s3)
- Palette: translucent pale amber with dark veins. Only reachable via sightings/vigil. Weak to Impact.

#### Volcano

**12. Ashcrawl** — *standing, tier 2, Crawler, hide: Stone — innate SCALE*
- Vigor 130–170, Power 4–6, Speed 4–5, Focus 50–60
- Temperament: Steady 0.7, Bold 0.3
- Forces: Heat, Impact
- Habitat: Ash Fields, Vents @ Dawn, Day, Dusk, Night (any)
- Tracks: six-point scuttle marks, stride 0.5, in ash. Hint: "Six points, repeated, straight up the side of a rock."
- Call: dry clicking. Hint: "Clicking from the rock face, from somewhere above eye level."
- Signature: **Mandible** (Strike/Impact p5 s1), **Ash Spray** (Arc/Heat p4 s1), **Cinder Sweep** (Sweep/Heat p4 s1)
- Palette: charcoal with orange seams. **The Scale key.** Weak to Surge.

**13. Pyreclaw** — *rare (apex), tier 3, Large biped, hide: Scale*
- Vigor 400–450, Power 8–10, Speed 4–5, Focus 90–100
- Temperament: Bold 1.0
- Forces: Heat, Impact, Cut
- Habitat: Crater Rim @ Night
- Tracks: enormous three-clawed prints, stride 2.5, only on the rim. Hint: "Three claws, each the length of your arm. You are close to the top."
- Call: roar with a crackle. Hint: "A roar you heard once from very far away, on your first morning."
- Signature: **Furnace** (Sweep/Heat p8 s1), **Talon** (Strike/Cut p9 s2), **Slam** (Strike/Impact p8 s1), **Pyre Bolt** (Bolt/Heat p7 s2)
- Palette: obsidian black with magma-glow seams; large. Weak to Surge — the intended answer is a heavily upgraded Surge move on Kelpmaw or a long-invested Mirefin, with Impact support and a Scale hide creature (Ashcrawl) tanking Heat.

### 13.3 Balance sanity targets

Use these as acceptance targets in the M7 balance pass, not as hard requirements:

- Starter Barrow vs a Bramblehog: 4–6 hits to down, taking 2–3 hits. ~30–45 s encounter.
- Starter Barrow vs Antlerback with no upgrades: Barrow downed before Antlerback loses 25%.
- A fresh Emberjack with Cinder Bite upgraded to power 5 vs Antlerback: winnable with one swap to Barrow for tanking. ~90 s.
- Kelpmaw with Undertow at power 8, plus Ashcrawl tanking, plus a third: Pyreclaw downable in 3–5 minutes with 1–2 party members downed. Should fail without Surge.
- Time from start to first Swim crossing: 15–25 minutes for a player who reads the guide.
- Total guide completion for a competent player: 3–5 hours.

### 13.4 Move naming

Signature moves have the fixed names above. Player-crafted moves are named by the player (max 18 chars, default suggested name `"<Force> <Delivery>"`, e.g. "Impact Lunge").

### 13.5 Text style

All in-game text — hints, notifications, gate prompts, guide labels — is written in a plain, dry field-notes voice. Short sentences. No exclamation marks except the driven-off message. No jokes. British spelling.

### 13.6 The opening beat (scripted, once)

Trigger: player first enters within 40 m of the Fern Chasm edge (Forest, north-east of Hollow Camp), any phase, within the first in-game day. If not triggered by the end of day 1, trigger at the next Dawn regardless of location by forcing the camera direction for 2 s (fallback).

Sequence (about 8 seconds, player retains movement control except the camera):

1. Camera drifts to look across the chasm and up toward the volcano rim on the horizon.
2. A Pyreclaw silhouette stands on the distant rim, backlit by vent glow; it raises its head and roars (call audio, quieter with distance).
3. The guide toast fires: *"New entry — something on the crater rim. Tier: far beyond you."* A Pyreclaw page is created with silhouette, one sighting (Crater Rim), one phase (current), and the call fact.
4. The silhouette turns and drops out of sight. Camera returns.

Design intent: the player sees the end of the game in the first two minutes and cannot get there. Everything they do afterward is, implicitly, a plan to get up that rim.

---

## 14. Architecture

### 14.1 Project layout

```
/src
  main.ts                 bootstrap: renderer, loop, load save or new game
  /engine
    loop.ts               fixed-step update (60 Hz) + variable render
    input.ts              key/mouse state, pointer lock
    events.ts             typed event bus
    rng.ts                seeded PRNG (mulberry32); seed stored in save
  /world
    terrain.ts            heightmap generation, biome masks, sampling
    water.ts              water volumes, depth query
    props.ts              instanced trees/rocks/cacti/vents per biome
    regions.ts            region polygons/circles, point→region lookup
    points.ts             camps, practice spots, gates, tracks placement
    sky.ts                sun/sky/fog by phase
  /creatures
    species.ts            typed access to species data
    bodyplans/            one module per body plan: build(spec) → Group + animate(t, state)
    individual.ts         rolling, serialisation
    ai.ts                 temperament positioning, detection meter, wild move selection
    spawn.ts              per-region spawn maintenance, despawn
  /combat
    moves.ts              Move type, delivery table, windup/cooldown maths
    resolve.ts            damage, hide multipliers, modifiers, downed/bond
    encounter.ts          encounter state machine
    projectiles.ts        Bolt/Arc simulation
  /guide
    notebook.ts           pure data: facts, stubs, merge, completion   ← serialisable, no Three imports
    observe.ts            observation system: tracks proximity, calls, LOS, move observation
    sightings.ts          rumour/sighting events, vigil counters, attraction
  /progression
    xp.ts                 awards, costs, familiarity gates
    workshop.ts           craft validation (body plan × species × spot)
    adjust.ts             stat/temperament adjustment costs
  /traversal
    gates.ts              requirement checks, traversal playback
    capability.ts         party tag capability computation
  /camp
    camp.ts               rest, fast travel, party management
  /player
    controller.ts         movement, crouch, sprint, camera
  /ui                     DOM overlay (vanilla TS + CSS, or lit-html if preferred)
    hud.ts  guide.ts  map.ts  camp.ts  workshop.ts  toasts.ts  pause.ts  debug.ts
  /save
    save.ts               versioned JSON to localStorage; notebook stored as its own key
  /data
    species.json  world.json  strings.json
/tests                    vitest unit tests for pure modules
```

### 14.2 Update order (per fixed step)

1. Input → player controller → camera
2. Time system (phase progression; emits `phaseChanged`)
3. Spawn system (on `phaseChanged` and every 2 s: maintain region populations)
4. Sighting system (on `phaseChanged`: roll events; every step: expiry, vigil counters)
5. Creature AI (all wild + active owned): detection meters, positioning, move selection
6. Combat resolution: windups, projectiles, hits, downed, bond windows
7. Observation system: tracks proximity, call range, LOS identification timers, move observation → notebook facts
8. Traversal/gates/camps: interaction prompts
9. Progression: XP awards from combat events
10. Save system: debounced autosave on flagged events
11. UI: read-only render of state (UI never mutates state directly; it dispatches actions)

### 14.3 Spawn system rules

- For each region, for each species eligible at the current phase, maintain `min..max` individuals (data: default 1..2; Hollow/Pond Hollow 1..3).
- Spawn points: random position within region radius that is on walkable terrain (slope < 30°, not in water unless species is aquatic), > 60 m from the player **or** occluded by terrain from the player's camera.
- Despawn: on phase change, individuals of no-longer-eligible species despawn when > 80 m from the player; when within 80 m they persist until they wander out (so a creature seen at the phase boundary doesn't vanish in front of the player).
- Wild idle behaviour: wander within the region (pick a point 5–15 m away every 4–8 s; pause 2–5 s), vocalise every 10–20 s during active phase (this is the `call` opportunity), avoid water/hazards unless immune.
- Hard cap: 24 wild individuals alive at once.

### 14.4 Determinism

All randomness goes through the seeded RNG. The seed is generated on new game and saved. Spawn positions, temperament rolls, and sighting rolls are reproducible for a given seed and sequence of phase changes, which the verification checkpoints rely on. Player-input-dependent randomness (e.g. Bolt miss on a moving target) is physics, not RNG.

### 14.5 Performance budget

- Target 60 fps at 1080p on an integrated GPU (2022 laptop).
- Instanced meshes for all vegetation and rocks. ≤ 200k triangles in view. One directional light with a 2048 shadow map, shadows only within 60 m.
- Terrain: 256×256 heightmap, rendered as 8×8 chunks with frustum culling.
- No post-processing beyond fog. Flat shading (MeshLambertMaterial or MeshStandardMaterial with `flatShading: true`).

---

## 15. Tech decisions

- **Three.js** r160+ (use whatever current stable is; pin it). **Vite** for dev/build. **TypeScript** strict mode.
- **No frameworks for UI.** DOM overlay written in vanilla TypeScript with CSS. (lit-html is acceptable if it materially reduces boilerplate; React/Vue are not — they're heavier than the problem.)
- **No external assets.** All geometry procedural. All textures generated on canvas at startup (tracks, ground detail, sky gradient). Fonts: one system font stack for UI, one webfont is acceptable only if bundled locally.
- **Audio:** Web Audio API, synthesised. Each species' call is a short oscillator/noise pattern described in data (`{waveform, notes: [{freq, dur}], noise?}`). Footsteps and hits as noise bursts. Music is out of scope for v1; a single ambient drone per biome is a should-have.
- **Save:** `localStorage`. Two keys: `fieldwork.save.v1` (world/player/roster state) and `fieldwork.notebook.v1` (the guide). Both JSON, both with a `schemaVersion`. Provide export/import as a JSON file download/upload in the pause menu.
- **Tests:** Vitest for all pure modules (`notebook.ts`, `resolve.ts`, `xp.ts`, `workshop.ts`, `capability.ts`, `sightings.ts` logic, `rng.ts`). Rendering is verified by the manual checkpoints and the debug console, not by automated tests.
- **Debug console** (backtick key), available in dev builds and behind a `?debug=1` flag in production. Commands:
  - `tp <campName>` — teleport to a camp (discovers it)
  - `time <Dawn|Day|Dusk|Night>` — jump to phase
  - `spawn <speciesId> [temperament]` — spawn a wild individual 15 m in front of the player
  - `give <n>` — give the active creature n XP
  - `reveal guide` — fill every fact for every species (for UI review)
  - `reveal map` — clear fog of war
  - `gates open` — mark all gates passed
  - `sighting <speciesId> <region>` — force a sighting event
  - `heal` — restore party
  - `seed` — print RNG seed
  - `save` / `load` / `wipe`

---

## 16. UI spec

All UI is a DOM layer over the canvas. Aesthetic: a field notebook — off-white paper texture (CSS gradient/noise, not an image asset), dark ink text, thin ruled lines, hand-drawn-feeling borders (CSS `border-radius` irregularities are fine). Monospace or humanist sans for body. No neon, no glass-morphism, no drop shadows heavier than 2 px.

### 16.1 HUD (always visible in play)

- **Top-left:** current phase name and a thin arc showing progress through the phase; day counter.
- **Top-right:** compass strip (N/NE/E…). When a sighting is active, a small marker at the bearing labelled with the region name.
- **Bottom-left:** party — three small cards; active one enlarged. Each shows creature name, HP bar, focus bar, downed state. Tab cycles.
- **Bottom-centre:** three move slots for the active creature: name, delivery/force glyphs, cooldown sweep, greyed if unaffordable.
- **Centre:** interaction prompt when in range of a camp / spot / gate / downed creature ("E — Rest", "E — Bond (hold)").
- **Toasts** (top-centre, stack, 4 s each): guide discoveries with the hint line, gate requirement reveals, sighting announcements, XP gains (aggregate, once per encounter).
- **Encounter target bar** (top-centre, below toasts): wild creature name or "Unknown creature", HP bar, detection eye icon before engagement.

### 16.2 Guide (G) — §6.4.

### 16.3 Camp menu (E at camp)

Tabs: **Rest** (four phase buttons with the resulting time shown), **Party** (roster grid → drag or click to fill 3 slots; each creature card shows species, name, temperament, four stats, XP), **Train** (select a party creature → its repertoire; equip to slots 1/2/3; upgrade a move — shows level, familiarity progress `12/15 uses`, cost, the five options; **Adjust** sub-panel with stat and temperament costs), **Travel** (list of discovered camps).

### 16.4 Workshop (E at practice spot)

Two-column builder: left = choices (delivery cards, force cards, power/speed steppers, name field); right = live preview of resulting stats (range, windup, cooldown, focus, tags, "Leap 3" if Lunge). Disabled choices show why ("Barrow's body can't Bolt", "This boulder can't teach Heat"). Confirm button shows XP cost and current XP.

### 16.5 Bond & naming

After a successful bond: brief modal — species name, rolled temperament and stats, moves inherited (with a line "You observed 2 of 3 moves"), name field, confirm. The creature goes to the roster.

### 16.6 Pause (Esc)

Resume, Controls, Export save, Import save, New game (confirm), and a small credits line.

---

## 17. Implementation plan

Eight milestones. Each has **deliverables** and **verification checkpoints**. Do not proceed until all checkpoints for a milestone pass. Where a checkpoint says "unit test", write it in Vitest and it must be green. Where it says "manual", perform it in the running game (using the debug console where indicated) and record the result in `/VERIFICATION.md` with a one-line note per check.

Estimated proportions of total effort are given as a guide, not a schedule.

---

### M0 — Skeleton world (≈10%)

**Deliverables**
- Vite + TS + Three.js project; `npm run dev`, `npm run build`, `npm test` all work.
- Fixed-step game loop, input, pointer-lock camera, third-person player capsule with WASD/sprint/crouch on a heightmap terrain with biome colouring by region mask (four biomes visibly distinct, arranged per §4.1).
- Water plane with depth query; player blocked in deep water; slopes > 45° block.
- Day/night: four phases, 3 min each, sky/sun/fog interpolation; HUD phase arc.
- Regions defined in `world.json`; point → region lookup; HUD shows current region name (debug only).
- Debug console with `tp`, `time`, `seed`.
- Seeded RNG.

**Checkpoints**
- [ ] Unit: `rng` produces identical sequences for identical seeds.
- [ ] Unit: `pointToRegion` returns the correct region for 5 fixture points including one in no region.
- [ ] Manual: walk from Hollow to South Shore (~3 min at walk speed); water blocks; steep slope blocks.
- [ ] Manual: `time Night` darkens the scene; the full cycle Dawn→Night→Dawn completes in 12 min ± 5 s.
- [ ] Manual: 60 fps with all four biomes' props in view from a hilltop (check with the Three.js stats panel).

---

### M1 — Creatures exist (≈12%)

**Deliverables**
- `species.json` with all 13 species per §13.2 (all fields).
- Eight body-plan builders producing distinct procedural models with idle/locomotion/execute animations; palette from species data.
- `individual.ts` rolling stats and temperament from species.
- Spawn system per §14.3 with wander and vocalise behaviours (vocalise = play synthesised call + emit `creatureCalled` event).
- Detection meter and temperament-based reaction (flee/aggro/hold) — no combat yet, aggro just means "approach and face".
- Debug `spawn`.

**Checkpoints**
- [ ] Unit: rolling 1000 individuals of each species yields stats within ranges and temperament frequencies within ±5% of weights (seeded).
- [ ] Unit: spawn eligibility — for each species, `isEligible(region, phase)` matches §13.2 habitat tables (write the table as a fixture).
- [ ] Manual: `time Dusk`, walk to Pond Hollow: Mirefin present, Bramblehog present, Loamox absent. `time Day`: Loamox present, Mirefin absent.
- [ ] Manual: `spawn thornwren` — it flees when you walk at it; approach crouched from behind a tree and the eye icon fills slower.
- [ ] Manual: stand still 60 s at Pond Hollow at Night; hear at least two distinct synthesised calls.
- [ ] Manual: all 13 species spawned side by side via `spawn` are visually distinguishable at 20 m.

---

### M2 — The field guide (≈14%)

**Deliverables**
- `notebook.ts`: pure data model per §6.1–6.2, including stubs, merge, completion computation, serialisation. **No Three.js imports.**
- Tracks decals placed per species per region (canvas-generated textures from stamp descriptors).
- `observe.ts`: tracks proximity (6 m), call range (25 m on `creatureCalled`), identification (frustum + 40 m + LOS raycast + 1.5 s cumulative), move observation (stub: fires on a placeholder `creatureExecutedMove` event until M3), temperament observation timer.
- Guide UI: Index, Species page with blanks, Map with fog of war and pins, Fragments (empty until M6).
- Toasts with hint lines.
- Starting state: Barrow's complete page; Pyreclaw page absent until M6.

**Checkpoints**
- [ ] Unit: notebook — add `tracks` and `call` for species X → two stubs; identify X → one page with both facts and zero stubs; `completion(X)` is `false`; fill all slots → `true`; `overallCompletion()` = 1/13 with only Barrow complete.
- [ ] Unit: notebook round-trips through JSON with no loss (deep-equal).
- [ ] Unit: sightings list caps at 20 and drops oldest.
- [ ] Manual: from Hollow Camp, walk the path: Bramblehog tracks toast appears with its hint; guide shows one stub under Unidentified.
- [ ] Manual: `time Dusk`, wait near the tracks: Bramblehog call stub appears as a **second** stub; then see it → both stubs merge into "Bramblehog" with the merge animation; habitat and phase populated.
- [ ] Manual: map fog reveals as you walk; sighting pin appears at the identification position.
- [ ] Manual: `reveal guide` then review every species page for layout/overflow issues.

---

### M3 — Combat (≈16%)

**Deliverables**
- `moves.ts`, `resolve.ts`, `encounter.ts`, `projectiles.ts` per §7.
- Active creature follow and temperament positioning; Tab swap; move slots 1/2/3 with cooldown/focus.
- Wild combat AI per §7.6; flee thresholds; detection→aggro; ambush bonus.
- Downed state, 8 s bond window, hold-E bond, capture flow with naming modal, inherited repertoire from observed moves.
- Driven-off flow.
- HUD: party cards, move slots, target bar, encounter state.
- `creatureExecutedMove` now fires for real; move observation populates the guide; hide/weakness/resistance facts on hit.
- Debug `heal`.

**Checkpoints**
- [ ] Unit: `damage()` reproduces the three worked examples in §7.4 exactly (14, 29, 48).
- [ ] Unit: `hideMultiplier()` for all 20 hide × force pairs matches §5.3.
- [ ] Unit: windup formula for (Speed 4, moveSpeed 1, Strike) = `0.6 × 0.96 × 0.9 = 0.518 s`; clamps to 0.25 s minimum.
- [ ] Unit: capture repertoire — species with 3 signature moves, 2 observed → 2 inherited; 0 observed → first signature only.
- [ ] Unit: focus — a creature with 10 focus cannot execute a 12-cost Arc.
- [ ] Manual: fight and bond a Bramblehog with Barrow; encounter takes 30–60 s; naming modal appears; new creature in roster with temperament and stats displayed.
- [ ] Manual: `spawn antlerback`, fight with Barrow only → driven off before Antlerback drops below 75%; wake at Hollow Camp one phase later; guide has Antlerback's hide and observed moves.
- [ ] Manual: `spawn bramblehog skittish`, approach crouched from behind, call Charge before the eye fills → first hit shows the ambush multiplier (verify via debug damage log).
- [ ] Manual: swap mid-fight with Tab; incoming creature appears after 2 s; outgoing keeps its HP.

---

### M4 — Training (≈12%)

**Deliverables**
- XP awards per §8.1; aggregate toast per encounter.
- Camp menu with Rest (no time cost yet beyond the jump), Party, Train (equip, upgrade with familiarity gate, five options, modifiers), Adjust (escalating stat costs, temperament shifts).
- Practice spots placed per §13.1; Workshop UI per §16.4 with validation per §8.3; craft animation against target.
- Modifiers implemented in `resolve.ts`.
- Debug `give`.

**Checkpoints**
- [ ] Unit: upgrade cost for level n = 10n; requires familiarity ≥ 5n; level 1 cannot add a modifier; level 2 can; max 2 modifiers.
- [ ] Unit: stat adjust costs 40, 80, 120 in sequence; temperament shift 80 then 200 then refused; Erratic → Steady allowed, Erratic → Bold refused.
- [ ] Unit: `canCraft(species, bodyPlan, spot, delivery, force)` — Loamox at Boulder: Strike/Impact yes, Bolt/Impact no (body), Strike/Heat no (species and spot); Mirefin at Spring: Bolt/Surge yes; Emberjack at Boulder: Strike/Heat no (spot) — write the full matrix as a table test.
- [ ] Manual: `give 60` to Barrow; craft "Slam" at Hollow Boulder (Strike/Impact p4); it appears in repertoire at level 0; equip it; use it 5 times; upgrade to level 1 (cost 10) — power 5; try to upgrade to level 2 with familiarity 5 → refused with the message showing `5/10 uses`.
- [ ] Manual: add Lingering to a Heat move and confirm the burn ticks 3 dmg/s for 3 s on the target bar; Follow-through knocks back 3 m.
- [ ] Manual: Adjust panel prices escalate visibly; after two temperament shifts the third option is absent.

---

### M5 — Gates, camps, traversal (≈12%)

**Deliverables**
- All 8 camps and 7 gates placed; camp discovery; Rest with phase jump and wake-at-camp; fast travel between discovered camps; autosave on camp actions.
- `capability.ts` computing party tag capability (max over equipped moves + innates).
- Gate prompts with requirement reveal; traversal playback per gate type (shatter, burn, carry across water, carry up cliff, leap chasm); persistent passed state; re-crossable traversal gates.
- Innate SWIM/SCALE from body plan; Leap from Lunge power.
- Heat hazard zones in Vents; creature pathing avoids them unless Scale/Stone.
- Player blocked from crossing water/cliffs without a gate.

**Checkpoints**
- [ ] Unit: `partyCapability()` — party of [Barrow with Charge p3 (Lunge), Mirefin, Bramblehog] → `{Impact: 3, Leap: 3, Swim: true, Scale: false, Heat: 0, Cut: 2 …}`; upgrading Charge to p5 → Leap 5.
- [ ] Unit: `gateCheck(gate, capability)` for all 7 gates against 3 fixture parties.
- [ ] Manual: without Mirefin, the South Shore channel prompt reads "needs Swim — your party: none"; bond a Mirefin, put it in the party (not active), press E → carry animation → arrive on Near Island; Shore Camp discoverable.
- [ ] Manual: Eastern Rockfall refuses Impact 3; upgrade a Lunge/Impact to p5 → shatters; stays shattered after save/load.
- [ ] Manual: at Hollow Camp rest to Dusk → time is Dusk, you are at Hollow Camp; fast travel to Shore Camp → still Dusk.
- [ ] Manual: Fern Chasm requires Leap 3; Charge at p3 leaps it; Ridge Camp beyond is discoverable and offers a view of the volcano.

---

### M6 — Sightings, rares, completion, opening (≈10%)

**Deliverables**
- Sighting events per §9.2A with toasts, compass marker, Fragments tab rumours, resolution/expiry.
- Attraction and vigil per §9.2B for the three rare species.
- Pyreclaw distant silhouette at Night from Ash Fields; opening beat per §13.6 with fallback trigger.
- Guide completion: per-page and overall; final page text and Complete stamp at 100%.
- Debug `sighting`, `reveal map`, `gates open`.

**Checkpoints**
- [ ] Unit: sighting roll with seeded RNG — over 100 simulated phase changes with no active sighting, 25–45 events; rare species selected ~3× as often as any single standing species.
- [ ] Unit: rumour → resolves to sighting on identification within the event; stays unconfirmed after expiry.
- [ ] Unit: vigil — rare species with 1 matching fragment, player in region full phase → spawn guaranteed; no fragment → never.
- [ ] Unit: `overallCompletion()` = 1.0 iff all 13 pages complete; final-page flag set.
- [ ] Manual: new game; walk toward Fern Chasm; opening beat plays; Pyreclaw page exists with silhouette, sighting, phase, call; Index shows 1/13 complete, 1 partial.
- [ ] Manual: `sighting glasswing "Salt Flats"`; toast gives bearing and region; compass marker appears; ignore it; after 3 min the Fragments tab shows an Unconfirmed entry.
- [ ] Manual: `tp "Dune Camp"`, rest to Dusk, walk to Salt Flats, stay the full phase → Glasswing spawns; identify → rumour resolves; page created.
- [ ] Manual: `reveal guide` → Index shows 13/13 and the final page is readable with the Complete stamp.

---

### M7 — Save, audio, balance, polish (≈14%)

**Deliverables**
- Full save/load of both keys with `schemaVersion`; autosave triggers (camp actions, guide discovery, capture, gate passed); export/import JSON in the pause menu; `wipe`.
- Synthesised audio for all 13 calls, footsteps, hits, gate traversals, UI clicks; per-biome ambient drone.
- Balance pass against §13.3 targets; tune power/vigor ranges and XP awards as needed and **record every change** in `/BALANCE.md`.
- Visual polish: creature hit flash, downed pose, dust/splash particles (simple sprite bursts), guide page transitions, paper texture.
- Performance pass to hit §14.5 budget.
- Controls overlay; pause menu; error boundary that offers export-save if the game throws.

**Checkpoints**
- [ ] Unit: save round-trip — a mid-game state (3 owned creatures, 6 pages, 2 gates passed, 3 camps) serialises and deserialises deep-equal; notebook key loads independently of world key.
- [ ] Manual: save at Grotto Camp, reload the page, continue: same time, same party HP, same guide, gates still passed, fog of war preserved.
- [ ] Manual: import a hand-edited save with `schemaVersion: 0` → clear error, no crash, offer to start new game.
- [ ] Manual: each balance target in §13.3 tested and result noted in `/BALANCE.md` (pass/fail and adjustments).
- [ ] Manual: 60 fps sustained during a fight with 6 wild creatures in view in the forest.
- [ ] Manual: the **golden path playthrough** below completes without using the debug console.

---

### Golden path playthrough (final acceptance)

Perform this end to end with debug console disabled. Record timings in `/VERIFICATION.md`. Target total: 3–5 hours; acceptable: 2.5–6.

1. Start. Read Barrow's page. Walk the Hollow path; find Bramblehog tracks. Trigger the opening beat at Fern Chasm.
2. Rest to Dusk at Hollow Camp. Return; hear and identify Bramblehog; fight and bond one.
3. Go to Pond Hollow at Dusk/Night; find Mirefin tracks (three-toed, water); identify; bond.
4. Cross the South Shore channel with Mirefin. Discover Shore Camp. Bond a Tidewhelk (any phase). Craft a Surge move for Mirefin at the tide pool.
5. Return to Hollow; drill an Impact Lunge on Barrow at the Boulder and log course; upgrade to p5 via fights. Break the Eastern Rockfall.
6. Desert at Night: Emberjack tracks (singed), identify, bond. Find the Tar Pit ember vent; craft a Heat move.
7. Return to Deep Wood at Day; defeat Antlerback with Emberjack (Heat) and Barrow (tank); bond it.
8. Burn Thorn Pass. Ash Fields: bond an Ashcrawl using Mirefin's Surge (Stone is weak to Surge).
9. Meanwhile: at least one sighting event occurs; follow or miss it; use the fragment to stand vigil for Glasswing (Salt Flats, Dusk) and Kelpmaw (Channels, Night). Bond Kelpmaw.
10. Invest Kelpmaw's XP into Undertow (target p8). Party: Kelpmaw, Ashcrawl, Antlerback or Barrow.
11. Cross Crater Ridge with Ashcrawl. Rest at Rim Camp to Night. Fight Pyreclaw; bond it.
12. Fill remaining facts (Saltwing, Dunecask, remaining moves/phases). Guide reaches 13/13; final page reads; Complete stamp.

**Pass criteria:** every step reachable using only information the guide provides; no step requires knowledge from this document; no soft-locks; no step where the intended tool (Swim/Impact/Heat/Scale/Surge) is unclear from in-game evidence.

---

## 18. Scope boundaries and latitude

### Out of scope for v1 (do not build, but do not design against)

- Multiplayer or shared notebooks. *(Keep the notebook a standalone serialisable object so this is a sync problem later, not a rewrite.)*
- Player free-text notes in the guide.
- Weather. *(A natural future fact axis; the fact-slot model should make adding `weather` a data change.)*
- Player HP, hunger, rations, item inventory.
- Story, NPCs, dialogue.
- Creature evolution, breeding, trading.
- Additional biomes/islands. *(The intended expansion path: new biome = new region data + species + gates.)*
- Real-time interruption of windups, dodge mechanics, blocking.
- Music beyond ambient drones.
- Mobile/touch controls.

### Where you have latitude

- Exact terrain shape, prop density, and the look of each body plan — as long as silhouettes are distinct and biomes read at a glance.
- Any numeric value marked as a starting value, **provided** the change is recorded in `/BALANCE.md` and the §13.3 targets still hold.
- UI layout details within the notebook aesthetic.
- Choice of lit-html vs vanilla DOM; choice of noise library; Three.js version.
- Adding debug tooling.

### Where you do not have latitude

- The pillars (§2).
- The camp/rest/fast-travel constraints (§4.4) — do not add wait-in-place or rest-anywhere.
- The familiarity gate on upgrades (§8.2) and the practice-spot requirement for crafting (§8.3).
- The escalating adjustment costs (§8.4) — these must remain expensive relative to move upgrades.
- Stub pages merging on identification (§6.2).
- Capture repertoire = observed moves (§7.5).
- The no-franchise-terminology rule (§0).
- Party size of 3; thirteen species; four biomes.

---

## Appendix A — Glossary

| Term | Meaning |
|---|---|
| **Active creature** | The one party member currently out and following the player / fighting. |
| **Bond / bond tag** | The capture action on a downed wild creature. |
| **Camp** | Fixed rest point; the only place to rest, fast travel, manage party, or upgrade. |
| **Fact / fact slot** | A single discoverable field on a species' guide page. |
| **Fragment** | A rumour or unconfirmed sighting not yet attached to a species page. |
| **Gate** | A world obstacle with a tag requirement. |
| **Individual** | A rolled instance of a species with its own stats, temperament, repertoire. |
| **Party** | The 3 creatures the player currently carries. |
| **Phase** | One of Dawn / Day / Dusk / Night; 3 real minutes. |
| **Practice spot** | A world location with a target where new moves can be crafted. |
| **Repertoire** | All moves an owned creature knows; 3 are equipped. |
| **Roster** | All owned creatures. |
| **Rumour** | The guide record created by a sighting event. |
| **Sighting** (event) | A timed, announced guaranteed spawn in a region. |
| **Sighting** (fact) | A logged identification with position/phase. |
| **Signature move** | A fixed move a wild species uses; inheritable on capture if observed. |
| **Stub** | A pre-identification guide page holding one fact. |
| **Tag** | Impact, Cut, Heat, Surge, Leap, Swim, Scale. |
| **Vigil** | Remaining in a rare species' habitat region for a full active phase. |

## Appendix B — Data schema sketches

```ts
// species.json entry
interface SpeciesData {
  id: string; name: string;
  rarity: 'standing' | 'rare';
  tier: 1 | 2 | 3;
  bodyPlan: BodyPlanId;
  hide: 'Bark' | 'Shell' | 'Scale' | 'Hide' | 'Stone';
  innate: ('Swim' | 'Scale')[];
  forces: Force[];
  stats: { vigor: [number, number]; power: [number, number]; speed: [number, number]; focus: [number, number] };
  temperament: Partial<Record<Temperament, number>>;
  habitat: { region: string; phases: Phase[] }[];
  signatureMoves: { name: string; delivery: Delivery; force: Force; power: number; speed: number }[];
  tracks: { kind: 'prints' | 'feather' | 'furrow' | 'shard' | 'coil'; toes?: number; drag?: boolean; stride?: number };
  hints: { tracks: string; call: string; identified: string };
  call: { waveform: OscillatorType; notes: { freq: number; dur: number }[]; noise?: number };
  palette: { primary: string; secondary: string; accent?: string };
  visual: Record<string, number>;   // body-plan-specific proportions
}

// notebook (guide) — fully serialisable
interface Notebook {
  schemaVersion: 1;
  pages: Record<string, SpeciesPage>;      // keyed by speciesId, only once identified
  stubs: Stub[];                            // { speciesId (hidden from UI), slot, value, region, discoveredDay }
  fragments: Rumour[];
  completedAt?: number;
}
interface SpeciesPage {
  identified: boolean;
  tracks?: true; call?: true; hide?: HideType; weakness?: Force; resistance?: Force;
  habitats: string[]; phases: Phase[];
  sightings: { region: string; pos: [number, number]; phase: Phase; day: number }[];
  movesObserved: string[]; temperaments: Temperament[];
  captured?: true;
}

// world.json
interface WorldData {
  regions: { id: string; biome: Biome; center: [number, number]; radius: number }[];
  camps: { id: string; name: string; pos: [number, number] }[];
  practiceSpots: { id: string; target: 'Boulder' | 'LogCourse' | 'Spring' | 'EmberVent'; pos: [number, number] }[];
  gates: { id: string; name: string; pos: [number, number]; farPos: [number, number]; requirement: { tag: Tag; magnitude?: number }; kind: 'rock' | 'thorn' | 'water' | 'cliff' | 'chasm' }[];
  tracks: { speciesId: string; pos: [number, number]; rot: number }[];
  hazards: { pos: [number, number]; radius: number; dps: number }[];
  spawnRules: { region: string; speciesId: string; min: number; max: number }[];
}
```

---

*End of document.*
