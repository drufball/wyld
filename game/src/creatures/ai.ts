import type { Rng } from '../engine/rng.js';
import { isOccludedByTerrain } from './spawn.js';
import type { Temperament } from './species.js';

type PlayerStance = 'walk' | 'sprint' | 'crouch';
type Reaction = 'flee' | 'aggro' | 'hold';
type Behaviour = 'wander' | Reaction;
type DetectionInput = {
  distance: number;
  visionRange: number;
  stance: PlayerStance;
  moving: boolean;
  hasCover: boolean;
};
type Point3 = { x: number; y: number; z: number };
type PropObstacle = { x: number; z: number; radius: number; height: number };
type PropIndex = { near: (from: Point3, to: Point3) => readonly PropObstacle[] };

const visionRange = (temperament: Temperament): number => (temperament === 'Skittish' ? 30 : 20);

const detectionRate = (input: DetectionInput): number => {
  if (input.hasCover || input.distance > input.visionRange) return -0.25;
  const proximity = 0.4 + 0.6 * (1 - Math.max(0, input.distance) / input.visionRange);
  const stanceFactor =
    input.stance === 'sprint'
      ? 2
      : input.stance === 'crouch'
        ? input.moving
          ? 0.5
          : 0.3
        : input.moving
          ? 1.35
          : 1;
  return 0.12 * proximity * stanceFactor;
};

const stepDetection = (meter: number, input: DetectionInput, dt: number): number =>
  Math.max(0, Math.min(1, meter + detectionRate(input) * Math.max(0, dt)));

const reactionFor = (temperament: Temperament, rng: Rng): Reaction => {
  if (temperament === 'Skittish') return 'flee';
  if (temperament === 'Bold') return 'aggro';
  if (temperament === 'Steady') return 'hold';
  return rng.next() < 0.5 ? 'flee' : 'aggro';
};

const releaseBehaviour = (
  behaviour: Behaviour,
  distance: number,
  range: number,
  meter: number,
  fleeExpired = false,
): Behaviour => {
  if (behaviour === 'flee') return fleeExpired ? 'wander' : behaviour;
  if ((behaviour === 'hold' || behaviour === 'aggro') && (distance > range || meter <= 0)) {
    return 'wander';
  }
  return behaviour;
};

const createPropIndex = (props: readonly PropObstacle[], cellSize = 20): PropIndex => {
  if (!(cellSize > 0)) throw new RangeError('cellSize must be positive');
  const cells = new Map<string, PropObstacle[]>();
  const key = (x: number, z: number): string => `${x},${z}`;
  for (const prop of props) {
    const minX = Math.floor((prop.x - prop.radius) / cellSize);
    const maxX = Math.floor((prop.x + prop.radius) / cellSize);
    const minZ = Math.floor((prop.z - prop.radius) / cellSize);
    const maxZ = Math.floor((prop.z + prop.radius) / cellSize);
    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const cellKey = key(x, z);
        const cell = cells.get(cellKey) ?? [];
        cell.push(prop);
        cells.set(cellKey, cell);
      }
    }
  }

  return {
    near(from, to) {
      let x = Math.floor(from.x / cellSize);
      let z = Math.floor(from.z / cellSize);
      const endX = Math.floor(to.x / cellSize);
      const endZ = Math.floor(to.z / cellSize);
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const stepX = Math.sign(dx);
      const stepZ = Math.sign(dz);
      const deltaX = stepX === 0 ? Infinity : cellSize / Math.abs(dx);
      const deltaZ = stepZ === 0 ? Infinity : cellSize / Math.abs(dz);
      let nextX =
        stepX === 0
          ? Infinity
          : ((stepX > 0 ? (x + 1) * cellSize : x * cellSize) - from.x) / dx;
      let nextZ =
        stepZ === 0
          ? Infinity
          : ((stepZ > 0 ? (z + 1) * cellSize : z * cellSize) - from.z) / dz;
      const nearby = new Set<PropObstacle>();
      while (true) {
        for (const prop of cells.get(key(x, z)) ?? []) nearby.add(prop);
        if (x === endX && z === endZ) break;
        if (nextX < nextZ) {
          x += stepX;
          nextX += deltaX;
        } else if (nextZ < nextX) {
          z += stepZ;
          nextZ += deltaZ;
        } else {
          x += stepX;
          z += stepZ;
          nextX += deltaX;
          nextZ += deltaZ;
        }
      }
      return [...nearby];
    },
  };
};

const hasCover = (
  eye: Point3,
  target: Point3,
  heightAt: (x: number, z: number) => number,
  props: readonly PropObstacle[] | PropIndex,
): boolean => {
  if (isOccludedByTerrain(eye, target, heightAt)) return true;
  const dx = target.x - eye.x;
  const dz = target.z - eye.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return false;
  const nearbyProps = 'near' in props ? props.near(eye, target) : props;
  return nearbyProps.some((prop) => {
    const amount = ((prop.x - eye.x) * dx + (prop.z - eye.z) * dz) / lengthSquared;
    if (amount <= 0 || amount >= 1) return false;
    const nearestX = eye.x + dx * amount;
    const nearestZ = eye.z + dz * amount;
    if (Math.hypot(prop.x - nearestX, prop.z - nearestZ) > prop.radius) return false;
    const rayY = eye.y + (target.y - eye.y) * amount;
    return heightAt(prop.x, prop.z) + prop.height > rayY;
  });
};

export {
  createPropIndex,
  detectionRate,
  hasCover,
  reactionFor,
  releaseBehaviour,
  stepDetection,
  visionRange,
};
export type { Behaviour, DetectionInput, PlayerStance, PropIndex, PropObstacle, Reaction };
