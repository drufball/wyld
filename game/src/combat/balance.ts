type ArenaBalance = { enemyHealthScale: number; enemyPowerScale: number };

// Simulated harness, seeds 1–5: trade informed/armed and informed/none win at 41.05 s (5/5).
// Trade uninformed is driven off at 32.23–44.87 s (5/5), leaving the enemy on 441–508 hp.
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
