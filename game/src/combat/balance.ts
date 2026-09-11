type ArenaBalance = { enemyHealthScale: number; enemyPowerScale: number };

// Harness seeds 1–5: trade informed/armed wins at 33.0–35.6 s (4/5) and loses at 38.9 s.
// Informed/none wins at 31.9–44.4 s (5/5); uninformed is driven off at 34.0–44.2 s (4/5).
const ARENA_BALANCE_PRESETS: Readonly<Record<'fast' | 'trade', ArenaBalance>> = {
  fast: { enemyHealthScale: 1, enemyPowerScale: 1 },
  trade: { enemyHealthScale: 3.25, enemyPowerScale: 0.42 },
};
const ARENA_BALANCE: ArenaBalance = ARENA_BALANCE_PRESETS.trade;
const scaledEnemyHealth = (vigor: number, balance = ARENA_BALANCE): number =>
  Math.max(1, Math.round(vigor * balance.enemyHealthScale));
const scaledEnemyDamage = (final: number, balance = ARENA_BALANCE): number =>
  Math.max(1, Math.round(final * balance.enemyPowerScale));

export { ARENA_BALANCE, ARENA_BALANCE_PRESETS, scaledEnemyDamage, scaledEnemyHealth };
export type { ArenaBalance };
