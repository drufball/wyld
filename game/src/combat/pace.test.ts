import { describe, expect, it } from 'vitest';
import { ARENA_PACE, arenaSpeedTilesPerSecond, worldSpeedTilesPerSecond } from './pace.js';

describe('arena pace', () => {
  it('halves the world walking speed for the arena', () => {
    expect(ARENA_PACE).toBe(0.5);
    expect(arenaSpeedTilesPerSecond(4)).toBe(worldSpeedTilesPerSecond(4) / 2);
  });

  it('leaves the world walking speed at three metres a second plus speed', () => {
    expect(worldSpeedTilesPerSecond(0)).toBe(1.5);
    expect(worldSpeedTilesPerSecond(5)).toBe(3);
  });
});
