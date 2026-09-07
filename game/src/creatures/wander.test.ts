import { describe, expect, it } from 'vitest';

import { createRng } from '../engine/rng.js';
import { createWander } from './wander.js';

describe('createWander', () => {
  it('is deterministic and chooses valid 5–15 metre legs', () => {
    const path = (seed: number) => {
      const wander = createWander(createRng(seed));
      const state = wander.begin(0, 0, 100, 0);
      const result = wander.step(state, { x: 0, z: 0 }, state.repickAt, 0, {
        speedStat: 5,
        canSwim: false,
        depthAt: () => 0,
        slopeAt: () => 0,
      });
      return { target: state.target, result };
    };
    expect(path(42)).toEqual(path(42));
    const target = path(42).target;
    expect(Math.hypot(target!.x, target!.z)).toBeGreaterThanOrEqual(5);
    expect(Math.hypot(target!.x, target!.z)).toBeLessThanOrEqual(15);
  });

  it('rejects steep and wet candidates for non-swimmers', () => {
    const wander = createWander(createRng(7));
    const state = wander.begin(0, 0, 100, 0);
    const now = state.repickAt;
    wander.step(state, { x: 0, z: 0 }, now, 0, {
      speedStat: 5,
      canSwim: false,
      depthAt: () => 1,
      slopeAt: () => 35,
    });
    expect(state.target).toBeNull();
    expect(state.pauseUntil - now).toBeGreaterThanOrEqual(2);
    expect(state.pauseUntil - now).toBeLessThanOrEqual(5);
  });
});
