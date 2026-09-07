import type { Rng } from './rng.js';

type Noise2D = (x: number, z: number) => number;

const fade = (value: number): number => value * value * (3 - 2 * value);
const mix = (a: number, b: number, amount: number): number => a + (b - a) * amount;

const hash = (x: number, z: number, seed: number): number => {
  let value = Math.imul(x, 0x1f123bb5) ^ Math.imul(z, 0x5f356495) ^ seed;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
};

const valueNoise2D = (x: number, z: number, seed: number): number => {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const tz = fade(z - z0);
  const north = mix(hash(x0, z0, seed), hash(x0 + 1, z0, seed), tx);
  const south = mix(hash(x0, z0 + 1, seed), hash(x0 + 1, z0 + 1, seed), tx);
  return mix(north, south, tz) * 2 - 1;
};

const createNoise2D = (rng: Rng): Noise2D => {
  const seed = Math.floor(rng.next() * 0x1_0000_0000) >>> 0;
  return (x, z) => valueNoise2D(x, z, seed);
};

const fbm = (
  x: number,
  z: number,
  octaves: number,
  lacunarity: number,
  gain: number,
  noise: Noise2D = (sampleX, sampleZ) => valueNoise2D(sampleX, sampleZ, 0),
): number => {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let normaliser = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += noise(x * frequency, z * frequency) * amplitude;
    normaliser += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }
  return normaliser === 0 ? 0 : total / normaliser;
};

export { createNoise2D, fbm, valueNoise2D };
export type { Noise2D };
