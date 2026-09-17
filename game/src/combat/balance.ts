type ArenaBalance = { enemyHealthScale: number; enemyPowerScale: number };

// Simulated one-out harness, seeds 1–5: trade informed/armed and informed/none win at
// 35.7 s with two swaps; uninformed is driven off at 35.8–36.4 s with three swaps.
const ARENA_BALANCE_PRESETS: Readonly<Record<'fast' | 'trade', ArenaBalance>> = {
  fast: { enemyHealthScale: 1, enemyPowerScale: 1 },
  trade: { enemyHealthScale: 2.25, enemyPowerScale: 0.42 },
};
const ARENA_BALANCE: ArenaBalance = ARENA_BALANCE_PRESETS.trade;
const scaledEnemyHealth = (vigor: number, balance = ARENA_BALANCE): number =>
  Math.max(1, Math.round(vigor * balance.enemyHealthScale));
const scaledEnemyDamage = (final: number, balance = ARENA_BALANCE): number =>
  Math.max(1, Math.round(final * balance.enemyPowerScale));

export { ARENA_BALANCE, ARENA_BALANCE_PRESETS, scaledEnemyDamage, scaledEnemyHealth };
export type { ArenaBalance };
