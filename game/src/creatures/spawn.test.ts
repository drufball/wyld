import { describe, expect, it } from 'vitest';

import { createRng } from '../engine/rng.js';
import type { Individual } from './individual.js';
import { createSpawnSystem, isOccludedByTerrain } from './spawn.js';

type Creature = {
  id: string;
  speciesId: string;
  position: { x: number; y: number; z: number };
};

const makeSystem = (
  seed = 1234,
  regions: readonly { id: string; x: number; z: number; radius: number }[] = [
    { id: 'hollow', x: 0, z: 0, radius: 100 },
  ],
  population = { min: 1, max: 3 },
) => {
  const creatures: Creature[] = [];
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
  return {
    creatures,
    system: createSpawnSystem({
      host,
      rng: createRng(seed),
      world: {
        regions: () => regions,
        populationFor: () => population,
        heightAt: () => 0,
        slopeAt: () => 0,
        depthAt: () => 0,
      },
    }),
  };
};

const snapshot = (creatures: readonly Creature[]) =>
  creatures.map(({ id, position }) => ({ id, position: { ...position } }));

describe('isOccludedByTerrain', () => {
  it('detects a hill but not flat ground', () => {
    const from = { x: 0, y: 2, z: 0 };
    const to = { x: 100, y: 0, z: 0 };
    expect(isOccludedByTerrain(from, to, (x) => (x > 40 && x < 60 ? 10 : 0))).toBe(true);
    expect(isOccludedByTerrain(from, to, () => 0)).toBe(false);
  });
});

describe('createSpawnSystem', () => {
  it('uses the configured min..max population target and is idempotent', () => {
    const { creatures, system } = makeSystem();
    expect(system.maintain('Day', { x: 1000, y: 0, z: 1000 }).spawned.length).toBeGreaterThan(0);
    expect(system.maintain('Day', { x: 1000, y: 0, z: 1000 }).spawned).toEqual([]);
    expect(creatures.length).toBeGreaterThanOrEqual(1);
    expect(creatures.length).toBeLessThanOrEqual(6);
  });

  it('only spawns outside 60 metres when the viewer is inside the flat region', () => {
    const viewer = { x: 0, y: 0, z: 0 };
    const { creatures, system } = makeSystem();
    system.maintain('Day', viewer);
    expect(creatures.length).toBeGreaterThan(0);
    expect(
      creatures.every(
        ({ position }) =>
          Math.hypot(position.x - viewer.x, position.y - viewer.y, position.z - viewer.z) > 60,
      ),
    ).toBe(true);
  });

  it('despawns newly ineligible distant creatures immediately', () => {
    const { creatures, system } = makeSystem();
    system.maintain('Day', { x: 1000, y: 0, z: 1000 });
    expect(creatures.some(({ speciesId }) => speciesId === 'loamox')).toBe(true);
    system.onPhaseChanged('Night', { x: 1000, y: 0, z: 1000 });
    expect(creatures.some(({ speciesId }) => speciesId === 'loamox')).toBe(false);
  });

  it('keeps nearby ineligible creatures until the viewer moves away', () => {
    const { creatures, system } = makeSystem();
    system.maintain('Day', { x: 1000, y: 0, z: 1000 });
    const loamox = creatures.find(({ speciesId }) => speciesId === 'loamox')!;
    system.onPhaseChanged('Night', loamox.position);
    expect(creatures).toContain(loamox);
    system.maintain('Night', { x: 1000, y: 0, z: 1000 });
    expect(creatures).not.toContain(loamox);
  });

  it('never exceeds the hard cap of 24', () => {
    const ids = [
      'hollow',
      'deep-wood',
      'pond-hollow',
      'south-shore',
      'near-island',
      'stack-island',
      'long-island',
      'channels',
      'dunes',
      'salt-flats',
      'mesa',
      'ash-fields',
      'vents',
      'crater-rim',
    ];
    const regions = ids.map((id, index) => ({ id, x: index * 250, z: 0, radius: 100 }));
    const { creatures, system } = makeSystem(2, regions, { min: 3, max: 3 });
    for (const phase of ['Dawn', 'Day', 'Dusk', 'Night'] as const)
      system.onPhaseChanged(phase, { x: 10_000, y: 0, z: 10_000 });
    expect(creatures).toHaveLength(24);
  });

  it('reproduces ids and positions for the same seed and script', () => {
    const run = () => {
      const result = makeSystem(1234);
      result.system.maintain('Day', { x: 1000, y: 0, z: 1000 });
      result.system.onPhaseChanged('Dusk', { x: 1000, y: 0, z: 1000 });
      result.system.update(2, 'Night', { x: -1000, y: 0, z: -1000 });
      return snapshot(result.creatures);
    };
    expect(run()).toEqual(run());
  });

  it('is unaffected by draws from independent wander and call streams', () => {
    const run = (drawUnrelated: boolean) => {
      const result = makeSystem(194 ^ 0x5fa1);
      const wanderRng = createRng(194 ^ 0x3b2d);
      const callRng = createRng(194 ^ 0x0ca1);
      result.system.maintain('Day', { x: 1000, y: 0, z: 1000 });
      if (drawUnrelated)
        for (let index = 0; index < 137; index += 1) {
          wanderRng.next();
          callRng.range(10, 20);
        }
      result.system.onPhaseChanged('Dusk', { x: 500, y: 0, z: 500 });
      result.system.update(2, 'Night', { x: -500, y: 0, z: -500 });
      return snapshot(result.creatures);
    };
    expect(run(true)).toEqual(run(false));
  });

  it('handles repeated phase notifications without spawning extras', () => {
    const { creatures, system } = makeSystem();
    system.onPhaseChanged('Day', { x: 1000, y: 0, z: 1000 });
    const first = snapshot(creatures);
    expect(system.onPhaseChanged('Day', { x: 1000, y: 0, z: 1000 }).spawned).toEqual([]);
    expect(system.onPhaseChanged('Day', { x: 1000, y: 0, z: 1000 }).spawned).toEqual([]);
    expect(snapshot(creatures)).toEqual(first);
    expect(creatures.length).toBeLessThanOrEqual(24);
  });
});
