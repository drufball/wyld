# M0 — Skeleton world verification (seed 194)

- **PASS — seeded RNG:** `pnpm --filter @wyld/game exec vitest run src/engine/rng.test.ts` compared 20 draws from each of two RNGs seeded `1234`; all 20 were identical (2 tests passed).
- **PASS — region lookup:** `pnpm --filter @wyld/game exec vitest run src/world/regions.test.ts` checked Hollow, Pond Hollow, Dunes, Crater Rim, and `(-390, 390)` outside every region; all 5 fixtures returned the expected result (6 tests passed including tie-breaking).
- **PASS — traversal (Planner review, headless Chromium at 1280×720):** From Shore Camp on Near Island, sprinting in all four directions for six seconds each stopped the player at exactly 0.60 m water depth every time, without entering deeper water. Fern Chasm walls sampled at 56–64°, above the 45° limit, and blocked traversal. Terrain height under the player tracked continuously throughout.
- **PASS — night and full cycle (Planner review, headless Chromium at 1280×720):** The clock advanced 9.98 s of game time per 10 s of wall time, putting a 720 s day inside the 12 min ± 5 s window. `debug('time Night')` changed the reported phase to Night and reduced mean sky brightness from 122.7 to 28.1 out of 255, remaining dark but playable.
- **PARTIAL — hilltop performance (headless Chromium at 1280×720 on SwiftShader):** Post-cull seed-194 samples were Hollow Camp 114,468 triangles / 33 calls; Ash Camp 8,752 / 10; Dune Camp 63,360 / 34; Mesa Camp 15,136 / 14; Shore Camp 112,614 / 61; and Rim Camp 4,656 / 8. Shore Camp, the worst open-water case from review, is below the 200,000-triangle cap with headroom. Planner-review frame rates before this fix ranged from 7.8–37.2 fps, but SwiftShader is a software rasteriser; those results do not verify the 60 fps target on an integrated GPU, which remains to be measured on real hardware.

## M1 — Creatures exist (2D, seed 194)

- **PASS — automated:** seeded individual rolls, habitat/phase spawn eligibility, hard-cap spawning, wandering, temperament reactions, calls, and sprite generation are covered by unit tests.
- **PASS — automated:** vision uses a 120° cone and 10/15-tile temperament ranges; cover and cliff tiles block Bresenham line of sight while water does not; only movement inside four tiles produces hearing.
- **PASS — automated:** each body plan produces a deterministic bottom-anchored 16/24/32-pixel sprite whose palette and proportions vary by species.
- **PENDING — Planner review:** all thirteen silhouettes remain distinct at phone scale.
- **PENDING — Planner review:** all thirteen species spawn, wander, call, and react correctly in the live 2D world.
- **PENDING — Planner review:** the eye meter appears above detected creatures and total draw calls remain below 40 with 24 creatures visible.

## M2 — The field guide (2D, seed 194)

- **PASS — automated:** notebook merging, JSON round-trip, sightings cap, completion, fog cells, and camp discovery remain covered by their existing unit tests.
- **PASS — automated:** track evidence uses a three-tile radius; identification requires 1.5 seconds within twenty tiles, on the same screen, with tile line of sight; audio calls retain their 25 m range.
- **PASS — automated:** standing-species track counts are asserted individually at four to eight decals, Pyreclaw evidence is on Crater Rim, and decals are restricted to walkable habitat ground.
- **PASS — track decal variants (Planner review):** all five `tracks.kind` variants were rendered from `trackDecalRects` at the 16 px tile scale and are legible at tile size; the `coil` reads as a three-bar switchback and the `shard` as a crossed glint.
- **Not placed in M2 — `coil` (Kelpmaw) and `shard` (Glasswing):** `placeTracks` places only standing species plus Pyreclaw's rim exception, so these two are absent at every seed (measured 0 at seeds 194, 7, 212, 1, 999, and 31337 while every placed species got 4–8). This is intentional per `wyld-spec.md` §13.1 for standing-species scoping and §13.2 for Kelpmaw's “none in the open; inside the grotto” line; Kelpmaw's coil arrives with the M5 grotto. Glasswing's spec entry has no “none in the open” caveat, so whether its shard should be placed on the Salt Flats is an open design question, deliberately left unchanged here.
- **PENDING — Planner review:** discover a track stamp and confirm its unknown-species toast and notebook stub.
- **PENDING — Planner review:** hear a call while looking away and confirm its 25 m range and notebook stub.
- **PENDING — Planner review:** observe a creature on the same screen with clear tile line of sight and confirm identification, merge, and sighting behaviour.
- **PENDING — Planner review:** reveal the guide/map and confirm completion, fog, camp, and pause behaviour.

## FIELDWORK in 2D — unit 1 (the tile world)

The tile-grid, deterministic pathfinding, phase palettes, viewport sizing, canvas renderer, tap input, and 2D public-state unit tests pass. At 375 × 812 the viewport is 11 × 22 tiles at 2×; at 1280 × 720 it is 20 × 15 tiles at 3×.

This unit resolves §6.1's “inside the camera frustum” as **“on the same screen, with tile line of sight ≤ 20 tiles”**, and the spawn cap's “occluded from the player” as **“not on the player's screen”**; unit 2 lands both fully. Section §13.6's opening beat and volcano on the horizon have **no 2D equivalent**: the opening beat is M6's problem, and for now the Crater Rim shows on the map from the start as a dark smudge.

## FIELDWORK in 2D — unit 2 (creatures)

- Automated: procedural sprites cover all eight body plans, tiers, determinism, variation, palettes, and transparent bounds.
- Automated: 2D detection covers the 120-degree cone, temperament tile ranges, Bresenham sight blockers, and four-tile movement hearing.
- Automated: tracks are counted per standing species, constrained to walkable habitat tiles, and include Pyreclaw at Crater Rim.
- Automated: observation uses three-tile track proximity and twenty-tile same-screen line-of-sight identification.
- Manual: creature silhouette readability on a phone — **pending Planner review**.
- Manual: all species spawn, wander, call, react, and display eye meters — **pending Planner review**.
- Manual: draw-call budget with 24 on-screen creatures — **pending Planner review**.

## FIELDWORK in 2D — unit 3 (the party)

- Automated: party roster, player/creature selection, wild targeting, formation offsets, and follower repathing are covered in `src/party/party.test.ts`.
- Automated: scenario query fallback and the fixed 20 × 12 six-rock arena are covered in `src/scenarios/scenarios.test.ts`.
- Automated: thumb-sized party, move, book, map, and gated console controls are covered in `src/ui/hud.test.ts`.
- Scenarios: `world`, `creatures`, `guide`, `party`, and `arena`.

## FIELDWORK — the arena, unit 1 (the place, the roster, the pick screens)

## Covered automatically

- Fixed roster data, species moves, hide match-ups and counter coverage.
- Immutable enemy and party selection, including the three-creature limit.
- Biome floors, six waist-high rocks, arena bounds and dry ground.
- Optional diagonal pathing, movement interpolation and frame-time percentiles.

## Manual review

- Check both pick screens at 375 × 812 and 1280 × 720.
- Pick each enemy and confirm its field, player, party and idle enemy placement.
- Confirm taps select one unit at a time and that the others hold position.
- Use `reveal guide`, then return to the enemy cards and inspect the known facts.

## Arena — learn, lose, repeat

### Arena enemy balance harness (simulated)

The 60 Hz unit harness used the 11 × 22 forest arena and seeds 1–5. These are simulated results
from this run (not browser-played results):

| preset | party / policy    |                          seed 1 |                          seed 2 |                          seed 3 |                          seed 4 |                          seed 5 |
| ------ | ----------------- | ------------------------------: | ------------------------------: | ------------------------------: | ------------------------------: | ------------------------------: |
| trade  | informed / armed  |                     win 22.65 s |                     win 24.38 s |                     win 25.05 s |                     win 23.08 s |                     win 24.38 s |
| trade  | informed / none   |                     win 24.35 s |                     win 23.52 s |                     win 24.38 s |                     win 29.40 s |                     win 21.05 s |
| trade  | uninformed / none | driven off 44.17 s (321/500 hp) | driven off 35.07 s (307/500 hp) | driven off 40.65 s (307/500 hp) | driven off 38.98 s (303/500 hp) | driven off 39.43 s (306/500 hp) |
| fast   | informed / armed  |                      win 7.52 s |                      win 7.52 s |                      win 7.52 s |                      win 6.67 s |                      win 6.85 s |
| fast   | informed / none   |                      win 7.52 s |                      win 7.57 s |                      win 7.53 s |                      win 7.10 s |                      win 7.57 s |
| fast   | uninformed / none | driven off 13.25 s (136/200 hp) | driven off 19.15 s (131/200 hp) | driven off 14.52 s (131/200 hp) | driven off 14.52 s (131/200 hp) | driven off 13.25 s (131/200 hp) |

The harness now uses the same player controller, bounded path planning, waypoint-centre walking,
last-waypoint snap, separation nudge, and frame ordering as the game. In the seed-1 zero-tap trace,
the old harness first diverged at 2.13 s when Cinder's Y tile remained about 9.75 while the game
controller snapped it to 9.50. After replacing the approximate walker, the built game ended at
24.38 s and the harness at 24.35 s (one 60 Hz tick apart). This local trace still does not reproduce
the lead's played 34.4 s result, and the informed runs still miss the named 30 s lower bound. The
constants and assertions remain unchanged; the discrepancy is recorded rather than silently
retuning or softening them.


- **PASS — autopilot cooldown DPS (`simulated`):** over 20 s at 60 Hz with seed 7, the armed creature dealt 108 damage and the identical unarmed creature dealt 108 damage.
- **PASS — move autopilot (built game, headless Chromium 375 × 812):** one tap on Grit's Mandible lit the button with `↻` and produced six attacks over twelve seconds with no further taps, measured 2.03, 2.01, 2.04, 1.97 and 2.06 s apart against its 2.00 s cooldown. A double tap on Ash Spray produced exactly one Ash Spray and left the armed move unchanged; tapping the lit button while its cooldown ran turned it off.
- **PASS — party-side combat tell (built game):** an enemy move resisted by a party creature displayed `Glances off` above that creature rather than above the enemy.
- **PASS — reserve swap (built game, headless Chromium at 375 × 812):** picked Antlerback and Barrow/Quill/Pip, confirmed Pip started as `reserveId: "thornwren"`, then pressed `S`. Pip entered at Barrow's exact `{ x: 5.5, y: 12.5 }` tile, Barrow became `reserveId: "loamox"`, the tray changed to `Swap · Barrow ◷5`, and the public swap cooldown reported `{ remaining: 5.03, total: 6 }` immediately after the exchange.
- **PASS — attack lunges:** every executed move lunges the attacker toward its target and back over 250 ms, peaking 0.45 tiles out, in both the flat and diorama looks; measured headless at 375 × 812 by sampling `__wyld.anim()` through a full Antlerback fight.
- **PASS — field guide escape:** the sticky guide header has a tap-to-close control, and every new fight starts with the guide closed.
- **PASS — frame time (headless Chromium):** measured p95 was 8.4 ms at 375 × 812 and 7.1 ms at 1280 × 720 during an Antlerback fight.
- **PASS — §7.4 damage:** measured neutral ×1.0, Bark/Heat ×1.6, and Bark/Cut ×0.6 in the combat event log.
- **NOTE — duration:** measured in the built game at 375 × 812 with both active creatures on autopilot and the reserve swapped in when they fell. The first, uninformed party — Barrow/Quill/Pip, whose moves are Impact and Cut against the Antlerback's Bark — is driven off at 13.05 s with the enemy still on 185 of 200 hp: the loss that teaches you the hide. The informed party that Heat gives you — Cinder/Grit/Barrow — is driven off at 19.72 s with the enemy down to 46 of 200: a close-run thing rather than a rout. §7's 30–90 s band is still not met, but the gap is now a balance question (party vigor against enemy power) rather than a missing mechanic, and the learning loop reads correctly in the numbers: knowing the weakness turns a 13-second rout into a fight you nearly win. Figures replace the 9.63 s and 11.48 s recorded before the reserve and autopilot units.
- **PASS — walkthrough:** from cleared `fieldwork.arena.v1`, picked Antlerback and Barrow/Quill/Pip, was driven off, and the result recorded Bark, Cut resistance, Bull Rush, and Bold temperament. Returned to the enemy card, selected Cinder, and won; the result added the Heat weakness. The guide paused and resumed the encounter from both G and Escape.

### Reserve deployment

- **Simulated:** at 1.9 s after the downed event the reserve is still benched and the countdown reads 0.10 s; on the 2.05 s tick it deploys and the countdown clears.
- **Simulated:** with the fallen creature at tile centre (5.5, 9.5) and the enemy at (5.7, 8.3), the automatically deployed reserve enters at tile centre (5.5, 10.5).
- **Simulated:** the incoming reserve takes no hit during the first 0.9 s of entry grace and takes a hit by 3.9 s after entry.


## Diorama

Measured in headless Chromium 151 with SwiftShader, seed 194. The party row was sampled with all
three party members on screen; the arena row was sampled during an Antlerback fight. Counts include
the shadow pass.

| Scene                   |   Viewport | Draw calls | Triangles | frameMsP50 | frameMsP95 |
| ----------------------- | ---------: | ---------: | --------: | ---------: | ---------: |
| World alone             | 1280 × 720 |         29 |    25,432 |      512.0 |      683.8 |
| `?scenario=creatures`   | 1280 × 720 |         40 |    27,892 |    1,084.4 |    1,170.5 |
| `?scenario=party`       | 1280 × 720 |         45 |    25,954 |      375.7 |      717.3 |
| `?scenario=arena` fight | 1280 × 720 |         46 |    14,716 |      270.3 |      469.6 |
| World alone             |  375 × 812 |         29 |    22,910 |      203.1 |      749.1 |
| `?scenario=creatures`   |  375 × 812 |         29 |    23,348 |      208.9 |      501.0 |
| `?scenario=party`       |  375 × 812 |         45 |    22,824 |      190.1 |      525.2 |
| `?scenario=arena` fight |  375 × 812 |         46 |    13,076 |      206.5 |      494.2 |

These `frameMsP50` / `frameMsP95` values are the values returned by `__wyld.perf()` in that run.
**SwiftShader frame times are not the 60 fps budget**; the frame-rate checkpoint still needs Dru's
laptop, as M0's PARTIAL did.

### Diorama turnarounds

These simulated silhouettes use the orthographic camera from `renderer.ts`, tilted 50° from
vertical, with each creature in its `idle` pose at t = 0 and no water, at 160 simulated pixels per
tile. Triangles are clipped at the world ground plane before projection, so buried geometry does
not contribute to the measurements. A plan is thin when side width is < 0.45 × front width, side area is < 0.55 × front area, or
non-null side head area is < 0.5 × front head area, or side fill is < 0.45.
A species reshaped in the workshop drops out of the table and baseline checks until the next
`UPDATE_TURNAROUND=1 pnpm --filter @wyld/game test turnaround` run.

#### Before (measuring pass, no plan change)

| Species | Angle | Width px | Height px | Area px | Fill | Head px | Thin? |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Loamox | front | 92 | 132 | 9528 | 0.78 | 3410 | — |
| Loamox | side | 169 | 145 | 13846 | 0.57 | 3304 | — |
| Loamox | back | 92 | 178 | 11672 | 0.71 | 3596 | — |
| Loamox | three-quarter | 166 | 185 | 14458 | 0.47 | 3934 | — |
| Bramblehog | front | 48 | 142 | 4267 | 0.63 | 1264 | — |
| Bramblehog | side | 218 | 80 | 6316 | 0.36 | 1182 | yes — side fill 0.36 |
| Bramblehog | back | 48 | 150 | 4852 | 0.67 | 1286 | — |
| Bramblehog | three-quarter | 151 | 121 | 5786 | 0.32 | 1278 | — |
| Thornwren | front | 156 | 79 | 6662 | 0.54 | 492 | — |
| Thornwren | side | 120 | 104 | 7067 | 0.57 | 481 | — |
| Thornwren | back | 156 | 91 | 6810 | 0.48 | 492 | — |
| Thornwren | three-quarter | 146 | 98 | 7233 | 0.51 | 537 | — |
| Mirefin | front | 140 | 96 | 8235 | 0.61 | — | — |
| Mirefin | side | 128 | 99 | 8262 | 0.65 | — | — |
| Mirefin | back | 140 | 96 | 8235 | 0.61 | — | — |
| Mirefin | three-quarter | 161 | 112 | 8819 | 0.49 | — | — |
| Antlerback | front | 146 | 204 | 22244 | 0.75 | 8280 | — |
| Antlerback | side | 252 | 235 | 32500 | 0.55 | 7503 | — |
| Antlerback | back | 146 | 287 | 27740 | 0.66 | 8280 | — |
| Antlerback | three-quarter | 248 | 298 | 34526 | 0.47 | 9310 | — |
| Tidewhelk | front | 108 | 134 | 9418 | 0.65 | 764 | — |
| Tidewhelk | side | 161 | 105 | 9976 | 0.59 | 748 | — |
| Tidewhelk | back | 108 | 114 | 8774 | 0.71 | 736 | — |
| Tidewhelk | three-quarter | 134 | 116 | 9702 | 0.62 | 732 | — |
| Saltwing | front | 248 | 121 | 14892 | 0.50 | 1112 | — |
| Saltwing | side | 179 | 163 | 16045 | 0.55 | 1083 | — |
| Saltwing | back | 248 | 132 | 15108 | 0.46 | 1114 | — |
| Saltwing | three-quarter | 230 | 151 | 16100 | 0.46 | 1207 | — |
| Kelpmaw | front | 32 | 142 | 1927 | 0.42 | 388 | — |
| Kelpmaw | side | 217 | 32 | 2148 | 0.31 | 389 | yes — side fill 0.31 |
| Kelpmaw | back | 32 | 149 | 2016 | 0.42 | 386 | — |
| Kelpmaw | three-quarter | 158 | 113 | 2132 | 0.12 | 388 | — |
| Emberjack | front | 48 | 140 | 4249 | 0.63 | 1260 | — |
| Emberjack | side | 218 | 79 | 6303 | 0.37 | 1184 | yes — side fill 0.37 |
| Emberjack | back | 48 | 150 | 4825 | 0.67 | 1282 | — |
| Emberjack | three-quarter | 151 | 120 | 5755 | 0.32 | 1278 | — |
| Dunecask | front | 162 | 189 | 19456 | 0.64 | 1258 | — |
| Dunecask | side | 238 | 146 | 20494 | 0.59 | 1234 | — |
| Dunecask | back | 162 | 163 | 18596 | 0.70 | 1216 | — |
| Dunecask | three-quarter | 197 | 162 | 20079 | 0.63 | 1218 | — |
| Glasswing | front | 244 | 122 | 14822 | 0.50 | 1112 | — |
| Glasswing | side | 181 | 160 | 15957 | 0.55 | 1090 | — |
| Glasswing | back | 244 | 132 | 15002 | 0.47 | 1110 | — |
| Glasswing | three-quarter | 226 | 148 | 15939 | 0.48 | 1207 | — |
| Ashcrawl | front | 196 | 167 | 15774 | 0.48 | 992 | — |
| Ashcrawl | side | 247 | 133 | 16397 | 0.50 | 1173 | — |
| Ashcrawl | back | 196 | 163 | 15627 | 0.49 | 994 | — |
| Ashcrawl | three-quarter | 224 | 152 | 16517 | 0.49 | 1102 | — |
| Pyreclaw | front | 264 | 351 | 63936 | 0.69 | 16080 | — |
| Pyreclaw | side | 126 | 397 | 39935 | 0.80 | 15369 | — |
| Pyreclaw | back | 264 | 373 | 66605 | 0.68 | 16080 | — |
| Pyreclaw | three-quarter | 252 | 409 | 62241 | 0.60 | 18891 | — |

#### After

<!-- turnaround:start -->
| Species | Angle | Width px | Height px | Area px | Fill | Head px | Thin? |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Loamox | front | 92 | 132 | 9528 | 0.78 | 3410 | — |
| Loamox | side | 169 | 145 | 13846 | 0.57 | 3304 | — |
| Loamox | back | 92 | 178 | 11672 | 0.71 | 3596 | — |
| Loamox | three-quarter | 166 | 185 | 14458 | 0.47 | 3934 | — |
| Bramblehog | front | 44 | 155 | 4445 | 0.65 | 1264 | — |
| Bramblehog | side | 218 | 83 | 8386 | 0.46 | 1182 | — |
| Bramblehog | back | 44 | 150 | 4783 | 0.72 | 1286 | — |
| Bramblehog | three-quarter | 151 | 128 | 7295 | 0.38 | 1278 | — |
| Thornwren | front | 156 | 79 | 6662 | 0.54 | 492 | — |
| Thornwren | side | 120 | 104 | 7067 | 0.57 | 481 | — |
| Thornwren | back | 156 | 91 | 6810 | 0.48 | 492 | — |
| Thornwren | three-quarter | 146 | 98 | 7233 | 0.51 | 537 | — |
| Mirefin | front | 140 | 96 | 8235 | 0.61 | — | — |
| Mirefin | side | 128 | 99 | 8262 | 0.65 | — | — |
| Mirefin | back | 140 | 96 | 8235 | 0.61 | — | — |
| Mirefin | three-quarter | 161 | 112 | 8819 | 0.49 | — | — |
| Antlerback | front | 146 | 204 | 22244 | 0.75 | 8280 | — |
| Antlerback | side | 252 | 235 | 32500 | 0.55 | 7503 | — |
| Antlerback | back | 146 | 287 | 27740 | 0.66 | 8280 | — |
| Antlerback | three-quarter | 248 | 298 | 34526 | 0.47 | 9310 | — |
| Tidewhelk | front | 108 | 134 | 9418 | 0.65 | 764 | — |
| Tidewhelk | side | 161 | 105 | 9976 | 0.59 | 748 | — |
| Tidewhelk | back | 108 | 114 | 8774 | 0.71 | 736 | — |
| Tidewhelk | three-quarter | 134 | 116 | 9702 | 0.62 | 732 | — |
| Saltwing | front | 248 | 121 | 14892 | 0.50 | 1112 | — |
| Saltwing | side | 179 | 163 | 16045 | 0.55 | 1083 | — |
| Saltwing | back | 248 | 132 | 15108 | 0.46 | 1114 | — |
| Saltwing | three-quarter | 230 | 151 | 16100 | 0.46 | 1207 | — |
| Kelpmaw | front | 32 | 145 | 2110 | 0.45 | 388 | — |
| Kelpmaw | side | 220 | 32 | 3173 | 0.45 | 389 | — |
| Kelpmaw | back | 31 | 150 | 2182 | 0.47 | 386 | — |
| Kelpmaw | three-quarter | 160 | 114 | 2738 | 0.15 | 388 | — |
| Emberjack | front | 44 | 153 | 4426 | 0.66 | 1260 | — |
| Emberjack | side | 218 | 82 | 8367 | 0.47 | 1184 | — |
| Emberjack | back | 42 | 150 | 4758 | 0.76 | 1282 | — |
| Emberjack | three-quarter | 151 | 127 | 7273 | 0.38 | 1278 | — |
| Dunecask | front | 162 | 189 | 19456 | 0.64 | 1258 | — |
| Dunecask | side | 238 | 146 | 20494 | 0.59 | 1234 | — |
| Dunecask | back | 162 | 163 | 18596 | 0.70 | 1216 | — |
| Dunecask | three-quarter | 197 | 162 | 20079 | 0.63 | 1218 | — |
| Glasswing | front | 244 | 122 | 14822 | 0.50 | 1112 | — |
| Glasswing | side | 181 | 160 | 15957 | 0.55 | 1090 | — |
| Glasswing | back | 244 | 132 | 15002 | 0.47 | 1110 | — |
| Glasswing | three-quarter | 226 | 148 | 15939 | 0.48 | 1207 | — |
| Ashcrawl | front | 196 | 167 | 15774 | 0.48 | 992 | — |
| Ashcrawl | side | 247 | 133 | 16397 | 0.50 | 1173 | — |
| Ashcrawl | back | 196 | 163 | 15627 | 0.49 | 994 | — |
| Ashcrawl | three-quarter | 224 | 152 | 16517 | 0.49 | 1102 | — |
| Pyreclaw | front | 264 | 351 | 63936 | 0.69 | 16080 | — |
| Pyreclaw | side | 126 | 397 | 39935 | 0.80 | 15369 | — |
| Pyreclaw | back | 264 | 373 | 66605 | 0.68 | 16080 | — |
| Pyreclaw | three-quarter | 252 | 409 | 62241 | 0.60 | 18891 | — |
<!-- turnaround:end -->

Bramblehog side fill 0.36 → 0.46, front width/height/area 48/142/4267 → 44/155/4445 (within 10 %; simulated).
Emberjack side fill 0.37 → 0.47, front width/height/area 48/140/4249 → 44/153/4426 (within 10 %; simulated).
Kelpmaw side fill 0.31 → 0.45, front width/height/area 32/142/1927 → 32/145/2110 (within 10 %; simulated). Its segments use 1.0 × 1.2 × 1.5 scale and rest at their scaled radius, keeping the body top below the head top while overlapping into a tube.

**Thin before any plan change:** Bramblehog (side fill 0.36), Emberjack (side fill 0.37), and Kelpmaw (side fill 0.31) (simulated).

### Arena — creatures move by temperament

In the 10.0 s headless idle-party fight against an Antlerback (simulated), Barrow finished 2.0
tiles from the player and 4.0 from the enemy, Quill finished 2.1 tiles from the player and 7.0
from the enemy, and Pip finished 2.0 tiles from the player and 8.0 from the enemy. The sampled
fight length was 10.0 s (simulated).

Roster pick cards show a temperament badge, active tray cards show the temperament beneath the
name (with species in the title), and the Swap detail shows the reserve temperament beside its
hide protection; these three DOM checks are simulated.

In the 60 Hz zero-tap fight against an Antlerback (simulated), Barrow travelled 8.12 tiles,
Quill travelled 17.84 tiles, and Pip travelled 3.06 tiles. The fight resolved as driven-off in
20.05 s (simulated).

In the built game at 375 × 812 in headless Chromium (played), Barrow travelled 3.34 tiles and
Quill travelled 16.21 tiles before both were downed with Pip standing in reserve after 10.73 s.
A CDP screenshot was captured 5.0 s into the fight (played).

### Renderer invariants

- The camera tilt is 50° from vertical; its frustum is anisotropic and deliberately does **not** fit
  the canvas aspect.
- Tile centres are at `i + 0.5`.
- Creature length comes from `TIER_LENGTH_TILES` (0.8 / 1.2 / 1.8 tiles), not from metres.
- Ambient light carries its own colour, separate from the sky.
- `groundSurfaceFor` sends `tree`, `rock`, and `fern` to the biome ground surface.
- Ground jitter is ±4% from the tile hash **after one LCG advance**.
- The build margin is 2 tiles.
- An `InstancedMesh` whose matrices are written after construction must have
  `computeBoundingSphere()` called or be marked `frustumCulled = false`; track decals were invisible
  for a whole review round while every unit test passed.

### Arena — creatures pick their own moves

- **Simulated:** At 60 Hz with seed 331, Barrow executed 3 moves, Quill 2, and Pip 3 in a zero-tap Antlerback fight. The first party execution was at 0.50 s, and the party was driven off at 10.12 s.
- **Played:** In the built game at 375 × 812 in headless Chromium, with no taps, Barrow executed 3 moves and Quill executed 4 before both active creatures were downed at 8.83 s with Pip standing in reserve. A CDP screenshot was captured at 5.0 s.

### Arena — obedience fades with distance

- **Simulated:** With seed 7 at five tiles, two identical encounters produced the same ten-order heard sequence, containing both heard and ignored results.
- **Simulated:** The order firing test fired the armed move at authority 1, yielded to the chooser at authority 1/6, and resumed the armed move at authority 1.
