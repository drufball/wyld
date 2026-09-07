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

  it('separates the archipelago islands with water', () => {
    const terrain = createTerrain(190);
    const islandCentres = [
      [-100, 340],
      [40, 380],
      [160, 330],
    ] as const;

    expect(terrain.heightAt(0, 300)).toBeLessThanOrEqual(-4);
    for (const [x, z] of islandCentres) {
      expect(terrain.heightAt(x, z)).toBeGreaterThanOrEqual(6);
      expect(terrain.heightAt(x, z)).toBeLessThanOrEqual(14);
    }

    for (let first = 0; first < islandCentres.length; first += 1) {
      for (let second = first + 1; second < islandCentres.length; second += 1) {
        const start = islandCentres[first];
        const end = islandCentres[second];
        if (start === undefined || end === undefined) continue;
        const crossing = Array.from({ length: 101 }, (_, index) => {
          const amount = index / 100;
          return terrain.heightAt(
            start[0] + (end[0] - start[0]) * amount,
            start[1] + (end[1] - start[1]) * amount,
          );
        });
        expect(Math.min(...crossing)).toBeLessThanOrEqual(-1);
      }
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
