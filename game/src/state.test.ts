import { describe, expect, it } from 'vitest';

import { buildState } from './state.js';

describe('game state', () => {
  it('builds a detached serializable state snapshot', () => {
    const camera = { x: 0, y: 3.2, z: 6 };
    const player = { x: 1, y: 0, z: 2 };
    const state = buildState({
      version: '0.0.0',
      elapsedSeconds: 1.5,
      camera,
      player,
      seed: 42,
      stance: 'walk',
      region: 'hollow',
      biome: 'forest',
      phase: 'Dawn',
      day: 1,
      phaseProgress: 0.25,
      waterDepth: 0,
      creatures: [
        {
          id: 'loamox-1',
          species: 'loamox',
          temperament: 'Bold',
          position: { x: 2, y: 1, z: 3 },
          state: 'idle',
          region: 'hollow',
          detection: 0.5,
          behaviour: 'wander',
        },
      ],
      guide: { open: false, tab: 'index', completion: 0, pages: [], stubs: [] },
      observe: { identifying: { species: null, progress: 0 } },
    });
    camera.x = 99;
    player.x = 99;
    expect(state).toEqual({
      version: '0.0.0',
      elapsedSeconds: 1.5,
      camera: { x: 0, y: 3.2, z: 6 },
      player: { x: 1, y: 0, z: 2 },
      seed: 42,
      stance: 'walk',
      region: 'hollow',
      biome: 'forest',
      phase: 'Dawn',
      day: 1,
      phaseProgress: 0.25,
      waterDepth: 0,
      creatures: [
        {
          id: 'loamox-1',
          species: 'loamox',
          temperament: 'Bold',
          position: { x: 2, y: 1, z: 3 },
          state: 'idle',
          region: 'hollow',
          detection: 0.5,
          behaviour: 'wander',
        },
      ],
      guide: { open: false, tab: 'index', completion: 0, pages: [], stubs: [] },
      observe: { identifying: { species: null, progress: 0 } },
    });
  });
});
