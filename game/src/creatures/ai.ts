import type { Rng } from '../engine/rng.js';
import type { TileGrid } from '../world/tiles.js';
import type { Temperament } from './species.js';
type Reaction = 'flee' | 'aggro' | 'hold';
type Behaviour = 'wander' | Reaction;
type DetectionInput = { distance: number; visionRange: number; visible: boolean; heard?: boolean };
type TilePoint = { x: number; y: number };
const visionRange = (temperament: Temperament): number => (temperament === 'Skittish' ? 15 : 10);
const insideVisionCone = (facing: number, from: TilePoint, to: TilePoint): boolean => {
  const angle = Math.atan2(to.x - from.x, to.y - from.y);
  const difference = Math.atan2(Math.sin(angle - facing), Math.cos(angle - facing));
  return Math.abs(difference) <= Math.PI / 3;
};
const hasLineOfSight = (
  grid: Pick<TileGrid, 'blocksSight'>,
  from: TilePoint,
  to: TilePoint,
): boolean => {
  let x = from.x,
    y = from.y;
  const dx = Math.abs(to.x - x),
    sx = x < to.x ? 1 : -1,
    dy = -Math.abs(to.y - y),
    sy = y < to.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    if (!(x === from.x && y === from.y) && !(x === to.x && y === to.y) && grid.blocksSight(x, y))
      return false;
    if (x === to.x && y === to.y) return true;
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
  }
};
const canSeePlayer = (
  grid: Pick<TileGrid, 'blocksSight'>,
  from: TilePoint,
  to: TilePoint,
  facing: number,
  temperament: Temperament,
): boolean =>
  Math.hypot(to.x - from.x, to.y - from.y) <= visionRange(temperament) &&
  insideVisionCone(facing, from, to) &&
  hasLineOfSight(grid, from, to);
const canHearPlayer = (distanceTiles: number, moving: boolean): boolean =>
  moving && distanceTiles <= 4;
const detectionRate = (input: DetectionInput): number => {
  if (!input.visible && !input.heard) return -0.25;
  const proximity = 0.4 + 0.6 * (1 - Math.max(0, input.distance) / input.visionRange);
  return 0.12 * Math.max(0.4, proximity);
};
const stepDetection = (meter: number, input: DetectionInput, dt: number): number =>
  Math.max(0, Math.min(1, meter + detectionRate(input) * Math.max(0, dt)));
const reactionFor = (t: Temperament, rng: Rng): Reaction =>
  t === 'Skittish'
    ? 'flee'
    : t === 'Bold'
      ? 'aggro'
      : t === 'Steady'
        ? 'hold'
        : rng.next() < 0.5
          ? 'flee'
          : 'aggro';
const releaseBehaviour = (
  b: Behaviour,
  distance: number,
  range: number,
  meter: number,
  fleeExpired = false,
): Behaviour =>
  b === 'flee'
    ? fleeExpired
      ? 'wander'
      : b
    : (b === 'hold' || b === 'aggro') && (distance > range || meter <= 0)
      ? 'wander'
      : b;
export {
  canHearPlayer,
  canSeePlayer,
  detectionRate,
  hasLineOfSight,
  insideVisionCone,
  reactionFor,
  releaseBehaviour,
  stepDetection,
  visionRange,
};
export type { Behaviour, DetectionInput, Reaction, TilePoint };
