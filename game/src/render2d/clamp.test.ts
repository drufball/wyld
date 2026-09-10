import { describe, expect, it } from 'vitest';
import { clamp } from './clamp.js';

describe('clamp', () => {
  it('returns the minimum when the value is below the minimum', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it('returns the maximum when the value is above the maximum', () => {
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('returns the value unchanged when it is inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
});
