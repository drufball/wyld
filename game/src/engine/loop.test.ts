import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_FRAME_MS, advance, createLoop, fixedStepFromQuery } from './loop.js';

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

describe('fixedStepFromQuery', () => {
  it.each([
    ['?fixedstep=1', true],
    ['fixedstep=1', true],
    ['', false],
    ['?fixedstep=0', false],
    ['?fixedstep=yes', false],
    ['?look=flat', false],
  ])('reads %j as %j', (search, expected) => {
    expect(fixedStepFromQuery(search)).toBe(expected);
  });
});

describe('manual loop', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not schedule frames and advances only to requested steps', () => {
    const requestAnimationFrame = vi.fn();
    vi.stubGlobal('window', {
      requestAnimationFrame,
      cancelAnimationFrame: vi.fn(),
    });
    const updates: number[] = [];
    const render = vi.fn();
    const loop = createLoop({
      manual: true,
      update: (dt) => updates.push(dt),
      render,
    });

    loop.start();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(render).not.toHaveBeenCalled();

    expect(loop.stepTo(5)).toBe(5);
    expect(updates).toEqual(Array(5).fill(1 / 60));
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenLastCalledWith(0);

    expect(loop.stepTo(8)).toBe(8);
    expect(updates).toEqual(Array(8).fill(1 / 60));
    expect(render).toHaveBeenCalledTimes(2);

    expect(loop.stepTo(8)).toBe(8);
    expect(updates).toHaveLength(8);
    expect(render).toHaveBeenCalledTimes(2);

    expect(loop.stepTo(2)).toBe(8);
    expect(updates).toHaveLength(8);
    expect(render).toHaveBeenCalledTimes(2);
  });
});
