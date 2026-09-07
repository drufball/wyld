import { describe, expect, it } from 'vitest';

import { createRng } from './rng.js';
import { createNoise2D, fbm } from './noise.js';

describe('noise', () => {
  it('repeats for the same seed', () => {
    const first = createNoise2D(createRng(190));
    const second = createNoise2D(createRng(190));
    expect([first(1.2, -8.3), first(99, 4)]).toEqual([second(1.2, -8.3), second(99, 4)]);
  });

  it('keeps value noise and normalised FBM in range', () => {
    const noise = createNoise2D(createRng(7));
    for (let index = 0; index < 100; index += 1) {
      expect(noise(index / 7, -index / 11)).toBeGreaterThanOrEqual(-1);
      expect(noise(index / 7, -index / 11)).toBeLessThanOrEqual(1);
      expect(fbm(index / 20, index / 30, 5, 2, 0.5, noise)).toBeGreaterThanOrEqual(-1);
      expect(fbm(index / 20, index / 30, 5, 2, 0.5, noise)).toBeLessThanOrEqual(1);
    }
  });
});
