import { describe, expect, it } from 'vitest';

import { createRng } from '../engine/rng.js';
import type { Individual } from './individual.js';
import { createSpawnSystem, isOccludedByTerrain } from './spawn.js';

describe('isOccludedByTerrain', () => {
  it('detects a hill but not flat ground', () => {
    const from = { x: 0, y: 2, z: 0 };
    const to = { x: 100, y: 0, z: 0 };
    expect(isOccludedByTerrain(from, to, (x) => (x > 40 && x < 60 ? 10 : 0))).toBe(true);
    expect(isOccludedByTerrain(from, to, () => 0)).toBe(false);
  });
});

describe('createSpawnSystem', () => {
  it('maintains populations idempotently and respects walkability', () => {
    const creatures: {
      id: string;
      speciesId: string;
      position: { x: number; y: number; z: number };
    }[] = [];
    const host = {
      add(individual: Individual, x: number, z: number) {
        const creature = {
          id: individual.id,
          speciesId: individual.speciesId,
          position: { x, y: 0, z },
        };
        creatures.push(creature);
        return creature;
      },
      remove(id: string) {
        const index = creatures.findIndex((entry) => entry.id === id);
        if (index >= 0) creatures.splice(index, 1);
      },
      list: () => creatures,
    };
    const system = createSpawnSystem({
      host,
      rng: createRng(1234),
      world: {
        regions: () => [{ id: 'hollow', x: 0, z: 0, radius: 100 }],
        populationFor: () => ({ min: 1, max: 3 }),
        heightAt: () => 0,
        slopeAt: (x) => (x < -90 ? 40 : 0),
        depthAt: (_x, z) => (z < -90 ? 1 : 0),
      },
    });
    expect(system.maintain('Day', { x: 1000, y: 0, z: 1000 }).spawned.length).toBeGreaterThan(0);
    expect(system.maintain('Day', { x: 1000, y: 0, z: 1000 }).spawned).toEqual([]);
    expect(creatures.every(({ position }) => position.x >= -90 && position.z >= -90)).toBe(true);
    expect(creatures.length).toBeLessThanOrEqual(24);
  });
});
