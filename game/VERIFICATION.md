# M0 — Skeleton world verification (seed 194)

- **PASS — seeded RNG:** `pnpm --filter @wyld/game exec vitest run src/engine/rng.test.ts` compared 20 draws from each of two RNGs seeded `1234`; all 20 were identical (2 tests passed).
- **PASS — region lookup:** `pnpm --filter @wyld/game exec vitest run src/world/regions.test.ts` checked Hollow, Pond Hollow, Dunes, Crater Rim, and `(-390, 390)` outside every region; all 5 fixtures returned the expected result (6 tests passed including tie-breaking).
- **PASS — traversal (Planner review, headless Chromium at 1280×720):** From Shore Camp on Near Island, sprinting in all four directions for six seconds each stopped the player at exactly 0.60 m water depth every time, without entering deeper water. Fern Chasm walls sampled at 56–64°, above the 45° limit, and blocked traversal. Terrain height under the player tracked continuously throughout.
- **PASS — night and full cycle (Planner review, headless Chromium at 1280×720):** The clock advanced 9.98 s of game time per 10 s of wall time, putting a 720 s day inside the 12 min ± 5 s window. `debug('time Night')` changed the reported phase to Night and reduced mean sky brightness from 122.7 to 28.1 out of 255, remaining dark but playable.
- **PARTIAL — hilltop performance (headless Chromium at 1280×720 on SwiftShader):** Post-cull seed-194 samples were Hollow Camp 114,468 triangles / 33 calls; Ash Camp 8,752 / 10; Dune Camp 63,360 / 34; Mesa Camp 15,136 / 14; Shore Camp 112,614 / 61; and Rim Camp 4,656 / 8. Shore Camp, the worst open-water case from review, is below the 200,000-triangle cap with headroom. Planner-review frame rates before this fix ranged from 7.8–37.2 fps, but SwiftShader is a software rasteriser; those results do not verify the 60 fps target on an integrated GPU, which remains to be measured on real hardware.

## M1 — Creatures exist (seed 194)

- **PASS — individual rolls:** 1000 rolls of each of the thirteen species produced integer stats inside every species range and temperament frequencies within 5 percentage points of the declared weights, from a seeded RNG.
- **PASS — spawn eligibility:** `isEligible` was checked against a habitat fixture transcribed from §13.2 for all 13 species × 18 regions × 4 phases — 936 combinations, all matching.
- **PASS — habitat by hour (Planner review, headless Chromium at 1280×720):** From Hollow Camp at Dusk, Pond Hollow held Mirefin and Bramblehog and no Loamox. After `time Day` the Mirefin were gone from Pond Hollow and Loamox were out in the Hollow, its own habitat region — §13.2 never places Loamox in Pond Hollow.
- **PASS — calls (Planner review, headless Chromium at 1280×720):** Standing still in Pond Hollow for 60 s at Dusk, 14 of the logged `creatureCalled` events fell inside the 60 m audible radius, from two distinct species — Bramblehog and Mirefin, the only two §13.2 places there at that hour. Repeating it at Night gave 12 events, all Mirefin, which is correct: §13.2 puts nothing else in that pond after dark. The earlier count of eleven species was world-wide and not range-filtered.
- **PASS — silhouettes at 20 m (Planner review):** All thirteen species spawned side by side at 2.6 m spacing and photographed from 20.7 m in daylight on open dune: quadrupeds, antlered bulk, shelled domes, serpentine chain, hovering avians, six-legged crawler and the tier-3 biped all read apart by shape and palette. Highest per-species geometry count 952 triangles (Kelpmaw), inside the 1500 budget.
- **PASS — spawn determinism (Planner review):** Two runs of the built game with the same seed driven through the same phase script produced identical creature counts, species and spawn positions; the only differences were sub-metre wander travel from frame-timing, which §14.4 does not cover.
- **PASS — detection and flight (Planner review, headless Chromium at 1280×720):** `spawn thornwren Skittish`, then walking at it: the meter climbed from 0 to a full 1 over about seven seconds of approach, the reaction rolled `flee`, and the bird ran from 11.5 m to 31.2 m in three seconds — 6.6 m/s, its own §5.2 speed — before returning to wandering. The HUD target bar showed "Unknown creature" with the eye fully filled.
- **PASS — crouch slows detection (Planner review):** Held at a fixed 15 m from a Thornwren for 8 s, the meter rose 0.02 → 0.73 walking upright (0.089/s) and 0.01 → 0.21 crouched (0.025/s) — crouching costs the player 28% of the upright fill rate, matching the 0.30 stance factor in §5.4's implementation.

## M2 — The field guide (seed 194)

- **PASS — notebook:** `pnpm --filter @wyld/game exec vitest run src/guide/notebook.test.ts` showed two stubs become one identified page and zero stubs, incomplete then complete with every fact, and the starting notebook at 1/13 completion (16 tests passed).
- **PASS — notebook JSON round-trip:** `pnpm --filter @wyld/game exec vitest run src/guide/notebook.test.ts` deep-compared a fully populated notebook after JSON serialisation and restoration (16 tests passed).
- **PASS — sightings cap:** `pnpm --filter @wyld/game exec vitest run src/guide/notebook.test.ts` recorded 22 sightings and retained the newest 20, dropping the oldest (16 tests passed).
- **PASS — fog cell maths and notebook round-trip:** `pnpm --filter @wyld/game exec vitest run src/guide/fog.test.ts src/guide/notebook.test.ts` checked corners, centre, the explicit 13-cell reveal, all 1600 cells, and JSON restoration with fog and camps (19 tests passed).
- **PASS — Tracks (Planner review, headless Chromium at 1280×720):** `tp -165.2 59.8` → toast `Unknown tracks — 2-toed, dragging, stride 0.5 — Forest (Hollow)` + hint; one stub — PASS
- **PASS — Call (Planner review, headless Chromium at 1280×720):** 14 m from a Thornwren at Dawn, looking away → `Unknown call — Forest (Hollow)`, a second stub — PASS
- **PASS — Merge (Planner review, headless Chromium at 1280×720):** `face` a wild Bramblehog → `Identified: Bramblehog. One earlier note attached.`, stubs → 0 — PASS
- **PASS — reveal guide (Planner review, headless Chromium at 1280×720):** → 13 pages, completion 1, fractions Loamox 12/12, Antlerback 13/13, Pyreclaw 14/14 — PASS
- **PASS — Fog (Planner review, headless Chromium at 1280×720):** 13 cells at spawn, 43 after a 5-hop path, 1600 after `reveal map`; Hollow Camp discovered at spawn; sighting pin at the identification position — PASS
- **PASS — Pause (Planner review, headless Chromium at 1280×720):** `elapsedSeconds` frozen 4.55 across 1.5 s with the book open — PASS

## FIELDWORK in 2D — unit 1 (the tile world)

The tile-grid, deterministic pathfinding, phase palettes, viewport sizing, canvas renderer, tap input, and 2D public-state unit tests pass. At 375 × 812 the viewport is 11 × 22 tiles at 2×; at 1280 × 720 it is 20 × 12 tiles at 3×.

This unit resolves §6.1's “inside the camera frustum” as **“on the same screen, with tile line of sight ≤ 20 tiles”**, and the spawn cap's “occluded from the player” as **“not on the player's screen”**; unit 2 lands both fully. Section §13.6's opening beat and volcano on the horizon have **no 2D equivalent**: the opening beat is M6's problem, and for now the Crater Rim shows on the map from the start as a dark smudge.
