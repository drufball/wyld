import { describe, expect, it } from 'vitest';

import { species } from '../creatures/species.js';
import { createRng } from '../engine/rng.js';
import { regions } from './regions.js';
import { placeTracks } from './tracks.js';

const props = regions().flatMap((region) =>
  [0, 12, -12, 24, -24].map((offset) => ({
    kind: 'rock',
    x: region.x + offset,
    z: region.z + offset / 2,
  })),
);
const options = (seed: number) => ({
  rng: createRng(seed),
  propPlacements: props,
  heightAt: (x: number, z: number) => x * 0.001 + z * 0.001,
  slopeAt: () => 0,
  depthAt: () => 0,
});

describe('placeTracks', () => {
  it('is deterministic and keeps every decal on standable ground inside its region', () => {
    const first = placeTracks(options(212));
    expect(placeTracks(options(212))).toEqual(first);
    for (const placement of first) {
      const region = regions().find(({ id }) => id === placement.regionId)!;
      expect(Math.hypot(placement.x - region.x, placement.z - region.z)).toBeLessThanOrEqual(
        region.radius,
      );
      expect(placement.y).toBeCloseTo(placement.x * 0.001 + placement.z * 0.001);
    }
  });

  it('places 4–8 decals for standing species and only rim prints for Pyreclaw', () => {
    const placements = placeTracks(options(7));
    for (const entry of species().filter(({ rarity }) => rarity === 'standing')) {
      const count = placements.filter(({ speciesId }) => speciesId === entry.id).length;
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(8);
    }
    expect(placements.some(({ speciesId }) => speciesId === 'kelpmaw')).toBe(false);
    expect(placements.some(({ speciesId }) => speciesId === 'glasswing')).toBe(false);
    expect(
      placements
        .filter(({ speciesId }) => speciesId === 'pyreclaw')
        .every(({ regionId }) => regionId === 'crater-rim'),
    ).toBe(true);
  });
});
