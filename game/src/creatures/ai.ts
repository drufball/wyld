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

const hasCover = (
  eye: Point3,
  target: Point3,
  heightAt: (x: number, z: number) => number,
  props: readonly PropObstacle[],
): boolean => {
  if (isOccludedByTerrain(eye, target, heightAt)) return true;
  const dx = target.x - eye.x;
  const dz = target.z - eye.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return false;
  return props.some((prop) => {
    const amount = ((prop.x - eye.x) * dx + (prop.z - eye.z) * dz) / lengthSquared;
    if (amount <= 0 || amount >= 1) return false;
    const nearestX = eye.x + dx * amount;
    const nearestZ = eye.z + dz * amount;
    if (Math.hypot(prop.x - nearestX, prop.z - nearestZ) > prop.radius) return false;
    const rayY = eye.y + (target.y - eye.y) * amount;
    return heightAt(prop.x, prop.z) + prop.height > rayY;
  });
};

export { detectionRate, hasCover, reactionFor, stepDetection, visionRange };
export type { Behaviour, DetectionInput, PlayerStance, PropObstacle, Reaction };
