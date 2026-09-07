import { describe, expect, it } from 'vitest';

import { createRng } from './rng.js';

describe('seeded random number generator', () => {
  it('repeats a sequence for the same seed and diverges for another seed', () => {
    const first = createRng(1234);
    const second = createRng(1234);
    const other = createRng(1235);
    const sequence = Array.from({ length: 20 }, () => first.next());
    expect(Array.from({ length: 20 }, () => second.next())).toEqual(sequence);
    expect(Array.from({ length: 20 }, () => other.next())).not.toEqual(sequence);
  });

  it('keeps integer and range draws in bounds and reports its seed', () => {
    const rng = createRng(0xffffffff + 8);
    expect(rng.seed()).toBe(7);
    for (let index = 0; index < 100; index += 1) {
      expect(rng.int(7)).toBeGreaterThanOrEqual(0);
      expect(rng.int(7)).toBeLessThan(7);
      expect(rng.range(-4, 2)).toBeGreaterThanOrEqual(-4);
      expect(rng.range(-4, 2)).toBeLessThan(2);
    }
  });
});
