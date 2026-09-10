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

- **PASS — attack lunges:** every executed move lunges the attacker toward its target and back over 250 ms, peaking 0.45 tiles out, in both the flat and diorama looks; measured headless at 375 × 812 by sampling `__wyld.anim()` through a full Antlerback fight.
- **PASS — field guide escape:** the sticky guide header has a tap-to-close control, and every new fight starts with the guide closed.
- **PASS — frame time (headless Chromium):** measured p95 was 8.4 ms at 375 × 812 and 7.1 ms at 1280 × 720 during an Antlerback fight.
- **PASS — §7.4 damage:** measured neutral ×1.0, Bark/Heat ×1.6, and Bark/Cut ×0.6 in the combat event log.
- **PASS — duration (60 Hz simulation):** Barrow/Quill/Pip vs Antlerback, driven headless at a fixed 1/60 s step in `encounter.test.ts`, measured 32.48 s to a win (was ~12 s before the pace change).
- **PASS — duration (played, headless Chromium 375 × 812):** the same fight driven by tapping a move on each creature about twice a second ended in a win at 20.1–22.2 s across three runs, against 12–13 s before the pace change.
- **PASS — walkthrough:** from cleared `fieldwork.arena.v1`, picked Antlerback and Barrow/Quill/Pip, was driven off, and the result recorded Bark, Cut resistance, Bull Rush, and Bold temperament. Returned to the enemy card, selected Cinder, and won; the result added the Heat weakness. The guide paused and resumed the encounter from both G and Escape.

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
