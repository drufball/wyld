import { describe, expect, it } from 'vitest';
import {
  GRIP_PIP_SECONDS,
  GRIP_SLOW_FACTOR,
  GRIP_WINDOW_SECONDS,
  applyGrip,
  emptyGrip,
  gripSpeedScale,
  gripsFrom,
} from './grip.js';

describe('grip', () => {
  it('a fresh grip takes one pip and reports GRIP_SLOW_FACTOR', () => {
    const result = applyGrip(emptyGrip(), 1);
    expect(result.grip.pips).toBe(1);
    expect(gripSpeedScale(result.grip, 1)).toBe(GRIP_SLOW_FACTOR);
  });
  it('three pips inside the window hold and clear the pips', () => {
    let grip = emptyGrip();
    for (const now of [1, 1.2, 1.4]) grip = applyGrip(grip, now).grip;
    expect(grip.pips).toBe(0);
    expect(gripSpeedScale(grip, 1.4)).toBe(0);
  });
  it('a third pip outside GRIP_WINDOW_SECONDS of the first does not hold', () => {
    let grip = applyGrip(emptyGrip(), 0).grip;
    grip = applyGrip(grip, GRIP_WINDOW_SECONDS).grip;
    const result = applyGrip(grip, GRIP_WINDOW_SECONDS + 0.01);
    expect(result.held).toBe(false);
  });
  it('a pip lapses after GRIP_PIP_SECONDS and the next hit starts the count again', () => {
    let grip = applyGrip(emptyGrip(), 1).grip;
    grip = applyGrip(grip, 1 + GRIP_PIP_SECONDS + 0.01).grip;
    expect(grip.pips).toBe(1);
    expect(grip.firstPipAt).toBe(1 + GRIP_PIP_SECONDS + 0.01);
  });
  it('grips only from Strike and Sweep', () => {
    expect((['Strike', 'Sweep'] as const).map(gripsFrom)).toEqual([true, true]);
    expect((['Bolt', 'Arc', 'Lunge'] as const).map(gripsFrom)).toEqual([false, false, false]);
  });
});
