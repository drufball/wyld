# Balance deviations

## Glasswing speed

Glasswing retains its Speed 7–8 range from §13.2, despite the tier-2 Speed 3–7 band in §5.2.
The species content table is authoritative, so validation permits this single numeric deviation.

## 2D fieldwork prop density

The original world-wide densities (placements per 1,000 m²) were too sparse at one 2 m tile per
cell. Conifer changed from **1.3 to 10**, broadleaf from **0.7 to 7**, fern from **1.5 to 16**, and
rock from **0.7 to 8**. The tree densities were reduced from their initial 2D values of 18 and 12 so
creatures' 5–8 tile sight lines are usually clear while the forest still reads as forest. Rejection
sampling and biome masks keep props concentrated in their intended biomes; rocks remain movement
obstacles but no longer block sight.

## Arena enemy scale

The arena has two named enemy-only presets: **fast** keeps health and damage at ×1, while
**trade** uses health ×2.25 and damage ×0.42. Trade is active: it is the founder's chosen dial for
bringing the encounter into §7's 30–90 s fight band without changing party stats, move data, or
combat rules.

At the active ×2.25 dial, the reconciled simulated harness sweep over seeds 1–5 measured trade's
informed party winning in **35.667 s** with either armed moves or zero taps. The uninformed party
was driven off in **38.983–41.183 s**, leaving the enemy on **299–304 of 450 hp**. Fast's informed
party won in **14.033 s** with either armed moves or zero taps; its uninformed party was driven off
in **24.817–24.850 s**, leaving **124 of 200 hp**.

The old harness differed from the game because the fight shared the world's random stream, it
started player-distance calculations at the corner rather than the centre of the player's tile,
and it supplied positions for benched members. Reconciliation gives each fight fresh dice and
matches the game's centre and active-position inputs. The uninformed test band was widened to
45 s rather than moving the balance dial.
