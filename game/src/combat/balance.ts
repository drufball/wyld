type ArenaBalance = { enemyHealthScale: number; enemyPowerScale: number };

// Fast measured a 9 s informed win and 13 s uninformed loss; trade measured a 34 s win and 27–39 s loss.
// Switch between those played arena dials only by changing the ARENA_BALANCE line below.
const ARENA_BALANCE_PRESETS: Readonly<Record<'fast' | 'trade', ArenaBalance>> = {
  fast: { enemyHealthScale: 1, enemyPowerScale: 1 },
  trade: { enemyHealthScale: 2.5, enemyPowerScale: 0.4 },
};
const ARENA_BALANCE: ArenaBalance = ARENA_BALANCE_PRESETS.trade;
const scaledEnemyHealth = (vigor: number, balance = ARENA_BALANCE): number =>
  Math.max(1, Math.round(vigor * balance.enemyHealthScale));
const scaledEnemyDamage = (final: number, balance = ARENA_BALANCE): number =>
  Math.max(1, Math.round(final * balance.enemyPowerScale));

export { ARENA_BALANCE, ARENA_BALANCE_PRESETS, scaledEnemyDamage, scaledEnemyHealth };
export type { ArenaBalance };
