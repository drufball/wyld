# M0 — Skeleton world verification (seed 194)

- **PASS — seeded RNG:** `pnpm --filter @wyld/game exec vitest run src/engine/rng.test.ts` compared 20 draws from each of two RNGs seeded `1234`; all 20 were identical (2 tests passed).
- **PASS — region lookup:** `pnpm --filter @wyld/game exec vitest run src/world/regions.test.ts` checked Hollow, Pond Hollow, Dunes, Crater Rim, and `(-390, 390)` outside every region; all 5 fixtures returned the expected result (6 tests passed including tie-breaking).
- **NOT MEASURED — traversal:** I could not perform the three-minute Hollow-to-South-Shore walk or manually challenge the water and steep-slope blockers because this environment has no runnable browser system libraries (`libatk-1.0.so.0` is absent). Automated water and slope tests pass, but that is not a substitute for this manual checkpoint.
- **NOT MEASURED — night and full cycle:** I could not visually confirm that `time Night` darkens the scene or time a full rendered cycle for the same missing-browser-library reason. The automated phase suite passes, but no manual 12-minute observation was made.
- **NOT MEASURED — hilltop performance:** I could not collect a rendered hilltop FPS/triangle/draw-call sample because Chromium cannot start without `libatk-1.0.so.0`. The debug stats panel is implemented and the complete automated suite passes; no FPS number is claimed.
