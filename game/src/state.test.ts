import { describe, expect, it } from 'vitest';

import { buildState, cameraPosition } from './state.js';

describe('game state', () => {
  it('drifts the camera around the creature', () => {
    expect(cameraPosition(0)).toEqual({ x: 0, y: 3.2, z: 6 });
    expect(cameraPosition(Math.PI / 0.24).z).toBeCloseTo(0);
  });

  it('builds a detached serializable state snapshot', () => {
    const camera = cameraPosition(0);
    const state = buildState('0.0.0', 1.5, camera);

    camera.x = 99;
    expect(state).toEqual({
      version: '0.0.0',
      elapsedSeconds: 1.5,
      camera: { x: 0, y: 3.2, z: 6 },
    });
  });
});
