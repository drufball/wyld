import { describe, expect, it } from 'vitest';

import { createTerrain, isSlopeStandable, sampleSlope } from './terrain.js';

describe('terrain sampling', () => {
  it('is continuous across a chunk boundary', () => {
    const terrain = createTerrain(190);
    let previous = terrain.heightAt(99.9, 17);
    for (let x = 99.91; x <= 100.1; x += 0.01) {
      const current = terrain.heightAt(x, 17);
      expect(Math.abs(current - previous)).toBeLessThan(0.05);
      previous = current;
    }
  });

  it('reports slope in degrees for a known gradient', () => {
    expect(sampleSlope((x, z) => x + z * 2, 0, 0)).toBeCloseTo(65.905, 3);
  });

  it('blocks only slopes steeper than 45 degrees', () => {
    expect(isSlopeStandable(45)).toBe(true);
    expect(isSlopeStandable(45.01)).toBe(false);
  });
});
