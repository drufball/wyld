import { describe, expect, it } from 'vitest';

import { species } from '../creatures/species.js';
import { createRng } from '../engine/rng.js';
import { regions } from './regions.js';
import { placeTracks } from './tracks.js';
import { createTileGrid, worldToTile } from './tiles.js';

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
  it('places every decal on a walkable tile', () => {
    const grid = createTileGrid({
      heightAt: () => 0,
      slopeAt: () => 0,
      depthAt: () => 0,
      biomeAt: () => 'forest',
      propPlacements: props.map(({ x, z }) => ({
        kind: 'rock' as const,
        x,
        z,
        y: 0,
        rotationY: 0,
        scale: 1,
      })),
    });
    const placements = placeTracks({
      ...options(212),
      isWalkable: (x, z) => {
        const { tx, ty } = worldToTile(x, z);
        return grid.isWalkable(tx, ty);
      },
    });
    for (const placement of placements) {
      const { tx, ty } = worldToTile(placement.x, placement.z);
      expect(grid.isWalkable(tx, ty)).toBe(true);
    }
  });
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

  it.each([194, 7, 212])(
    'places 4–8 decals for standing species and only rim prints for Pyreclaw (seed %i)',
    (seed) => {
      const placements = placeTracks(options(seed));
      for (const entry of species().filter(({ rarity }) => rarity === 'standing')) {
        const count = placements.filter(({ speciesId }) => speciesId === entry.id).length;
        expect(count).toBeGreaterThanOrEqual(4);
        expect(count).toBeLessThanOrEqual(8);
      }
      // Kelpmaw and Glasswing are rare; the spec places decals only for standing species, and Kelpmaw's coil belongs to the M5 grotto.
      expect(placements.some(({ speciesId }) => speciesId === 'kelpmaw')).toBe(false);
      expect(placements.some(({ speciesId }) => speciesId === 'glasswing')).toBe(false);
      const pyreclaw = placements.filter(({ speciesId }) => speciesId === 'pyreclaw');
      expect(pyreclaw.length).toBeGreaterThanOrEqual(4);
      expect(pyreclaw.length).toBeLessThanOrEqual(8);
      expect(pyreclaw.every(({ regionId }) => regionId === 'crater-rim')).toBe(true);
    },
  );

  it('falls back to region chords when no props provide cover', () => {
    const placements = placeTracks({ ...options(194), propPlacements: [] });
    for (const entry of species().filter(
      ({ rarity, id }) => rarity === 'standing' || id === 'pyreclaw',
    )) {
      const count = placements.filter(({ speciesId }) => speciesId === entry.id).length;
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(8);
    }
  });
});
