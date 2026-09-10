// Arena movement runs at half the world's walking pace so a fight is something
// you steer rather than react to.
const ARENA_PACE = 0.5;
const worldSpeedTilesPerSecond = (speedStat: number): number => (3 + speedStat * 0.6) / 2;
const arenaSpeedTilesPerSecond = (speedStat: number): number =>
  worldSpeedTilesPerSecond(speedStat) * ARENA_PACE;

export { ARENA_PACE, arenaSpeedTilesPerSecond, worldSpeedTilesPerSecond };
