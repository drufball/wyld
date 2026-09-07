import { createNoise2D, fbm } from '../engine/noise.js';
import { createRng } from '../engine/rng.js';
import type { Biome } from './regions.js';

const WORLD_SIZE = 800;
const WORLD_HALF = WORLD_SIZE / 2;
const HEIGHTMAP_SIZE = 256;

type BiomeWeights = Record<Biome, number>;
type HeightField = (x: number, z: number) => number;
type Terrain = {
  heightmap: Float32Array;
  heightAt(x: number, z: number): number;
  slopeAt(x: number, z: number): number;
  biomeAt(x: number, z: number): Biome;
  biomeWeightsAt(x: number, z: number): BiomeWeights;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;
const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const amount = clamp01((value - edge0) / (edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
};
const gaussian = (x: number, z: number, cx: number, cz: number, radius: number): number =>
  Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * radius * radius));

const sampleSlope = (heightField: HeightField, x: number, z: number, step = 1): number => {
  const dx = (heightField(x + step, z) - heightField(x - step, z)) / (2 * step);
  const dz = (heightField(x, z + step) - heightField(x, z - step)) / (2 * step);
  return (Math.atan(Math.hypot(dx, dz)) * 180) / Math.PI;
};
const isSlopeStandable = (slopeDegrees: number): boolean => slopeDegrees <= 45;

const createTerrain = (seed: number): Terrain => {
  const noise = createNoise2D(createRng(seed));
  const warp = (x: number, z: number): number => fbm(x / 170, z / 170, 4, 2, 0.5, noise);
  const rawWeights = (x: number, z: number): BiomeWeights => {
    const boundaryWarp = warp(x, z) * 42;
    const volcano = smoothstep(-210, -260, z + boundaryWarp);
    const archipelago = smoothstep(220, 280, z + boundaryWarp * 0.2);
    const middle = (1 - volcano) * (1 - archipelago);
    const desert = middle * smoothstep(-10, 55, x + boundaryWarp);
    const forest = middle * (1 - smoothstep(-10, 55, x + boundaryWarp));
    const total = forest + desert + archipelago + volcano;
    return {
      forest: forest / total,
      desert: desert / total,
      archipelago: archipelago / total,
      volcano: volcano / total,
    };
  };

  const forestHeight = (x: number, z: number): number => {
    let height = 14 + fbm(x / 120, z / 120, 5, 2, 0.48, noise) * 9;
    const alongChasm = z + 180 - (x + 40) * 0.55;
    const chasmLength = smoothstep(150, 80, Math.abs(x + 40));
    height -= 27 * Math.exp(-(alongChasm * alongChasm) / (2 * 9 * 9)) * chasmLength;
    height -= 17 * gaussian(x, z, -220, 160, 42);
    return height;
  };
  const desertHeight = (x: number, z: number): number => {
    const dunes = 12 + fbm(x / 52, z / 52, 4, 2.1, 0.48, noise) * 10;
    const salt = gaussian(x, z, 300, -60, 70);
    const mesaShape = smoothstep(1, 0.72, Math.hypot((x - 250) / 78, (z + 180) / 60));
    return lerp(dunes, 3.5, salt) + mesaShape * 20;
  };
  const archipelagoHeight = (x: number, z: number): number => {
    const islands: ReadonlyArray<readonly [number, number, number, number]> = [
      [-100, 340, 28, 14],
      [40, 380, 25, 13],
      [160, 330, 30, 14],
      [260, 375, 26, 13],
      [-250, 360, 27, 12],
    ];
    let height = -5 + fbm(x / 80, z / 80, 3, 2, 0.5, noise) * 1.2;
    for (const [cx, cz, radius, peak] of islands) height += gaussian(x, z, cx, cz, radius) * peak;
    return height;
  };
  const volcanoHeight = (x: number, z: number): number => {
    const distance = Math.hypot(x, z + 390);
    const cone = Math.max(8, 126 - distance * 0.48);
    const crater = 38 * gaussian(x, z, 0, -390, 12);
    const roughness = fbm(x / 38, z / 38, 4, 2, 0.55, noise) * (3 + distance * 0.018);
    return cone - crater + roughness;
  };
  const proceduralHeight = (x: number, z: number): number => {
    const weights = rawWeights(x, z);
    return (
      forestHeight(x, z) * weights.forest +
      desertHeight(x, z) * weights.desert +
      archipelagoHeight(x, z) * weights.archipelago +
      volcanoHeight(x, z) * weights.volcano
    );
  };

  const heightmap = new Float32Array(HEIGHTMAP_SIZE * HEIGHTMAP_SIZE);
  const weightmaps: Record<Biome, Float32Array> = {
    forest: new Float32Array(heightmap.length),
    desert: new Float32Array(heightmap.length),
    archipelago: new Float32Array(heightmap.length),
    volcano: new Float32Array(heightmap.length),
  };
  for (let iz = 0; iz < HEIGHTMAP_SIZE; iz += 1) {
    const z = -WORLD_HALF + (iz / (HEIGHTMAP_SIZE - 1)) * WORLD_SIZE;
    for (let ix = 0; ix < HEIGHTMAP_SIZE; ix += 1) {
      const x = -WORLD_HALF + (ix / (HEIGHTMAP_SIZE - 1)) * WORLD_SIZE;
      const index = iz * HEIGHTMAP_SIZE + ix;
      heightmap[index] = proceduralHeight(x, z);
      const weights = rawWeights(x, z);
      for (const biome of Object.keys(weightmaps) as Biome[])
        weightmaps[biome][index] = weights[biome];
    }
  }

  const interpolate = (values: Float32Array, x: number, z: number): number => {
    const mapX = clamp01((x + WORLD_HALF) / WORLD_SIZE) * (HEIGHTMAP_SIZE - 1);
    const mapZ = clamp01((z + WORLD_HALF) / WORLD_SIZE) * (HEIGHTMAP_SIZE - 1);
    const x0 = Math.floor(mapX);
    const z0 = Math.floor(mapZ);
    const x1 = Math.min(x0 + 1, HEIGHTMAP_SIZE - 1);
    const z1 = Math.min(z0 + 1, HEIGHTMAP_SIZE - 1);
    const tx = mapX - x0;
    const tz = mapZ - z0;
    const north = lerp(
      values[z0 * HEIGHTMAP_SIZE + x0] ?? 0,
      values[z0 * HEIGHTMAP_SIZE + x1] ?? 0,
      tx,
    );
    const south = lerp(
      values[z1 * HEIGHTMAP_SIZE + x0] ?? 0,
      values[z1 * HEIGHTMAP_SIZE + x1] ?? 0,
      tx,
    );
    return lerp(north, south, tz);
  };
  const heightAt = (x: number, z: number): number => interpolate(heightmap, x, z);
  const biomeWeightsAt = (x: number, z: number): BiomeWeights => ({
    forest: interpolate(weightmaps.forest, x, z),
    desert: interpolate(weightmaps.desert, x, z),
    archipelago: interpolate(weightmaps.archipelago, x, z),
    volcano: interpolate(weightmaps.volcano, x, z),
  });
  const biomeAt = (x: number, z: number): Biome => {
    const weights = biomeWeightsAt(x, z);
    return (Object.keys(weights) as Biome[]).reduce((best, biome) =>
      weights[biome] > weights[best] ? biome : best,
    );
  };
  const slopeAt = (x: number, z: number): number => sampleSlope(heightAt, x, z);

  return { heightmap, heightAt, slopeAt, biomeAt, biomeWeightsAt };
};

export { HEIGHTMAP_SIZE, WORLD_HALF, WORLD_SIZE, createTerrain, isSlopeStandable, sampleSlope };
export type { Biome, BiomeWeights, HeightField, Terrain };
