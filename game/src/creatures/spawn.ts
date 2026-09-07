import type { Rng } from '../engine/rng.js';
import type { Phase } from '../world/time.js';
import type { Individual } from './individual.js';
import { roll } from './individual.js';
import { isEligible, species } from './species.js';

type Position = { x: number; y: number; z: number };
type SpawnHost = {
  add(individual: Individual, x: number, z: number, facingY: number): { id: string };
  remove(id: string): void;
  list(): readonly { id: string; speciesId: string; position: Position }[];
};
type SpawnWorld = {
  regions(): readonly { id: string; x: number; z: number; radius: number }[];
  populationFor(regionId: string): { min: number; max: number };
  heightAt(x: number, z: number): number;
  slopeAt(x: number, z: number): number;
  depthAt(x: number, z: number): number;
};
type SpawnResult = { spawned: string[]; despawned: string[] };

const isOccludedByTerrain = (
  from: Position,
  to: Position,
  heightAt: (x: number, z: number) => number,
  steps = 24,
): boolean => {
  for (let index = 1; index < steps; index += 1) {
    const amount = index / steps;
    const x = from.x + (to.x - from.x) * amount;
    const z = from.z + (to.z - from.z) * amount;
    const rayY = from.y + (to.y - from.y) * amount;
    if (heightAt(x, z) > rayY) return true;
  }
  return false;
};

const createSpawnSystem = ({
  world,
  host,
  rng,
}: {
  world: SpawnWorld;
  host: SpawnHost;
  rng: Rng;
}) => {
  const membership = new Map<string, string>();
  const pending = new Set<string>();
  let accumulator = 0;
  let sequence = 0;
  const distance = (position: Position, viewer: Position): number =>
    Math.hypot(position.x - viewer.x, position.y - viewer.y, position.z - viewer.z);
  const sweepPending = (viewer: Position, result: SpawnResult): void => {
    for (const id of [...pending]) {
      const creature = host.list().find((entry) => entry.id === id);
      if (!creature) {
        pending.delete(id);
        membership.delete(id);
        continue;
      }
      if (distance(creature.position, viewer) > 80) {
        host.remove(id);
        pending.delete(id);
        membership.delete(id);
        result.despawned.push(id);
      }
    }
  };
  const maintain = (phase: Phase, viewer: Position): SpawnResult => {
    const result: SpawnResult = { spawned: [], despawned: [] };
    sweepPending(viewer, result);
    for (const region of world.regions()) {
      const population = world.populationFor(region.id);
      for (const data of species()) {
        if (!isEligible(data.id, region.id, phase)) continue;
        let count = host
          .list()
          .filter(
            (entry) => membership.get(entry.id) === region.id && entry.speciesId === data.id,
          ).length;
        while (count < population.min && membership.size < 24) {
          let candidate: Position | null = null;
          for (let attempt = 0; attempt < 24; attempt += 1) {
            const angle = rng.range(0, Math.PI * 2);
            const radius = Math.sqrt(rng.next()) * region.radius;
            const x = region.x + Math.cos(angle) * radius;
            const z = region.z + Math.sin(angle) * radius;
            const y = world.heightAt(x, z);
            if (world.slopeAt(x, z) >= 30) continue;
            if (!data.innate.includes('Swim') && world.depthAt(x, z) > 0) continue;
            const point = { x, y, z };
            const far = distance(point, viewer) > 60;
            const occluded = isOccludedByTerrain(
              { x: viewer.x, y: viewer.y + 1.6, z: viewer.z },
              point,
              world.heightAt,
            );
            if (far || occluded) {
              candidate = point;
              break;
            }
          }
          if (!candidate) break;
          const individual = roll(data, rng, `wild-${rng.seed()}-${sequence++}`);
          host.add(individual, candidate.x, candidate.z, rng.range(-Math.PI, Math.PI));
          membership.set(individual.id, region.id);
          result.spawned.push(individual.id);
          count += 1;
        }
      }
    }
    return result;
  };
  const onPhaseChanged = (phase: Phase, viewer: Position): SpawnResult => {
    const result: SpawnResult = { spawned: [], despawned: [] };
    for (const creature of host.list()) {
      const regionId = membership.get(creature.id);
      if (!regionId || isEligible(creature.speciesId, regionId, phase)) continue;
      if (distance(creature.position, viewer) > 80) {
        host.remove(creature.id);
        membership.delete(creature.id);
        pending.delete(creature.id);
        result.despawned.push(creature.id);
      } else pending.add(creature.id);
    }
    const maintained = maintain(phase, viewer);
    result.spawned.push(...maintained.spawned);
    result.despawned.push(...maintained.despawned);
    return result;
  };
  const update = (dt: number, phase: Phase, viewer: Position): SpawnResult => {
    accumulator += dt;
    if (accumulator < 2) return { spawned: [], despawned: [] };
    accumulator %= 2;
    return maintain(phase, viewer);
  };
  return {
    maintain,
    onPhaseChanged,
    update,
    creatureRegion: (id: string) => membership.get(id) ?? null,
  };
};

export { createSpawnSystem, isOccludedByTerrain };
export type { SpawnHost, SpawnWorld };
