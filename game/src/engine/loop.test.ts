import { describe, expect, it } from 'vitest';

import { MAX_FRAME_MS, advance } from './loop.js';

const step = 1000 / 60;

describe('fixed-step accumulator', () => {
  it('advances one update for a 16.7 ms frame', () => {
    expect(advance({ accumulator: 0 }, 16.7, step).steps).toBe(1);
  });
  it('advances three updates for 50 ms and preserves the remainder', () => {
    const result = advance({ accumulator: 0 }, 50, step);
    expect(result.steps).toBe(3);
    expect(result.accumulator).toBeCloseTo(0);
  });
  it('accumulates a frame shorter than one step', () => {
    expect(advance({ accumulator: 0 }, 5, step)).toEqual({ steps: 0, accumulator: 5 });
  });
  it('clamps a long frame', () => {
    expect(advance({ accumulator: 0 }, 5000, step).steps).toBeLessThanOrEqual(
      Math.floor(MAX_FRAME_MS / step),
    );
  });
});
