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

  it('allows swimmers to choose a target in water', () => {
    const choose = (canSwim: boolean) => {
      const wander = createWander(createRng(7));
      const state = wander.begin(0, 0, 100, 0);
      wander.step(state, { x: 0, z: 0 }, state.repickAt, 0, {
        speedStat: 5,
        canSwim,
        depthAt: () => 1,
        slopeAt: () => 0,
      });
      return state.target;
    };
    expect(choose(false)).toBeNull();
    expect(choose(true)).not.toBeNull();
  });

  it('repicks between four and eight seconds after a completed leg', () => {
    const wander = createWander(createRng(11));
    const state = wander.begin(0, 0, 100, 0);
    const options = { speedStat: 5, canSwim: false, depthAt: () => 0, slopeAt: () => 0 };
    wander.step(state, { x: 0, z: 0 }, state.repickAt, 0, options);
    const target = { ...state.target! };
    wander.step(state, { x: 0, z: 0 }, 10, 100, options);
    const repickAt = state.repickAt;
    expect(repickAt).toBeGreaterThanOrEqual(14);
    expect(repickAt).toBeLessThanOrEqual(18);
    wander.step(state, target, repickAt - 0.001, 0, options);
    expect(state.target).toBeNull();
    wander.step(state, target, repickAt, 0, options);
    expect(state.target).not.toBeNull();
  });

  it('retains the travelled facing after a leg completes', () => {
    const wander = createWander(createRng(42));
    const state = wander.begin(0, 0, 100, 0, 1.25);
    const options = { speedStat: 5, canSwim: false, depthAt: () => 0, slopeAt: () => 0 };
    wander.step(state, { x: 0, z: 0 }, state.repickAt, 0, options);
    const target = state.target!;
    const expectedFacing = Math.atan2(target.x, target.z);
    const completed = wander.step(state, { x: 0, z: 0 }, 10, 100, options);
    expect(completed.facing).toBeCloseTo(expectedFacing);
    expect(wander.step(state, target, 10.1, 0, options).facing).toBeCloseTo(expectedFacing);
  });
});
