import { describe, expect, it } from 'vitest';
import { buildState } from './state.js';
describe('game state', () => {
  it('builds the 2D public state without camera or stance', () => {
    const state = buildState({
      version: '0',
      elapsedSeconds: 1,
      player: { x: 1, y: 2, z: 3 },
      screen: { x: 2, y: 3 },
      tile: { x: 40, y: 50 },
      seed: 42,
      region: null,
      biome: 'forest',
      phase: 'Dawn',
      day: 1,
      phaseProgress: 0,
      waterDepth: 0,
    });
    expect(state).toMatchObject({ screen: { x: 2, y: 3 }, tile: { x: 40, y: 50 }, creatures: [] });
    expect(state).not.toHaveProperty('camera');
    expect(state).not.toHaveProperty('stance');
  });
});
