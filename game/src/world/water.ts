import worldData from '../data/world.json';

type HeightSampler = (x: number, z: number) => number;
type CircleWater = {
  id: string;
  kind: 'pond';
  surfaceY: number;
  circle: { x: number; z: number; radius: number };
};
type BandWater = {
  id: string;
  kind: 'sea';
  surfaceY: number;
  southBand: { minZ: number; maxZ: number; minX: number; maxX: number };
};
type WaterBody = CircleWater | BandWater;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isWaterBody = (value: unknown): value is WaterBody => {
  if (!isRecord(value) || !isString(value.id) || !isNumber(value.surfaceY) || !isString(value.kind))
    return false;
  if (value.kind === 'pond')
    return (
      isRecord(value.circle) &&
      isNumber(value.circle.x) &&
      isNumber(value.circle.z) &&
      isNumber(value.circle.radius) &&
      value.circle.radius > 0
    );
  if (value.kind === 'sea')
    return (
      isRecord(value.southBand) &&
      isNumber(value.southBand.minZ) &&
      isNumber(value.southBand.maxZ) &&
      isNumber(value.southBand.minX) &&
      isNumber(value.southBand.maxX) &&
      value.southBand.minZ < value.southBand.maxZ &&
      value.southBand.minX < value.southBand.maxX
    );
  return false;
};

if (!Array.isArray(worldData.water) || !worldData.water.every(isWaterBody))
  throw new TypeError('Invalid water data');
const waterBodies: readonly WaterBody[] = worldData.water;
const contains = (body: WaterBody, x: number, z: number): boolean =>
  body.kind === 'pond'
    ? Math.hypot(x - body.circle.x, z - body.circle.z) <= body.circle.radius
    : x >= body.southBand.minX &&
      x <= body.southBand.maxX &&
      z >= body.southBand.minZ &&
      z <= body.southBand.maxZ;

const createDepthAt =
  (heightAt: HeightSampler, bodies: readonly WaterBody[] = waterBodies) =>
  (x: number, z: number): number => {
    let depth = 0;
    for (const body of bodies)
      if (contains(body, x, z)) depth = Math.max(depth, body.surfaceY - heightAt(x, z));
    return Math.max(0, depth);
  };

const isWaterStandable = (depth: number): boolean => depth <= 0.6;

export { createDepthAt, isWaterStandable, waterBodies };
export type { HeightSampler, WaterBody };
