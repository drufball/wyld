import worldData from '../data/world.json';

type Biome = 'forest' | 'desert' | 'archipelago' | 'volcano';
type Region = { biome: Biome; id: string; name: string; x: number; z: number; radius: number };
type Camp = { id: string; name: string; regionId: string; x: number; z: number };
type WorldData = { regions: Region[]; camps: Camp[] };

const biomes: readonly string[] = ['forest', 'desert', 'archipelago', 'volcano'];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isBiome = (value: unknown): value is Biome => isString(value) && biomes.includes(value);
const isRegion = (value: unknown): value is Region =>
  isRecord(value) &&
  isBiome(value.biome) &&
  isString(value.id) &&
  isString(value.name) &&
  isNumber(value.x) &&
  isNumber(value.z) &&
  isNumber(value.radius) &&
  value.radius > 0;
const isCamp = (value: unknown): value is Camp =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isString(value.regionId) &&
  isNumber(value.x) &&
  isNumber(value.z);
const isWorldData = (value: unknown): value is WorldData =>
  isRecord(value) &&
  Array.isArray(value.regions) &&
  value.regions.every(isRegion) &&
  Array.isArray(value.camps) &&
  value.camps.every(isCamp);

if (!isWorldData(worldData)) throw new TypeError('Invalid world data');
const data: WorldData = worldData;

const regions = (): readonly Region[] => data.regions;
const camps = (): readonly Camp[] => data.camps;

const pointToRegion = (x: number, z: number): Region | null => {
  let closest: Region | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const region of data.regions) {
    const distance = Math.hypot(x - region.x, z - region.z) / region.radius;
    if (
      distance <= 1 &&
      (distance < closestDistance - Number.EPSILON * 16 ||
        (Math.abs(distance - closestDistance) <= Number.EPSILON * 16 &&
          closest !== null &&
          region.id < closest.id))
    ) {
      closest = region;
      closestDistance = distance;
    }
  }
  return closest;
};

export { camps, pointToRegion, regions };
export type { Biome, Camp, Region };
