import * as THREE from 'three';

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

const createWater = (heightAt: HeightSampler) => {
  const group = new THREE.Group();
  group.name = 'water';
  const material = new THREE.MeshPhongMaterial({
    color: 0x438e9b,
    emissive: 0x102c3b,
    emissiveIntensity: 0.18,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    flatShading: true,
    shininess: 65,
    depthWrite: false,
  });
  for (const body of waterBodies) {
    const geometry =
      body.kind === 'pond'
        ? new THREE.CircleGeometry(body.circle.radius, 40)
        : new THREE.PlaneGeometry(
            body.southBand.maxX - body.southBand.minX,
            body.southBand.maxZ - body.southBand.minZ,
            24,
            6,
          );
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    if (body.kind === 'pond') mesh.position.set(body.circle.x, body.surfaceY, body.circle.z);
    else
      mesh.position.set(
        (body.southBand.minX + body.southBand.maxX) / 2,
        body.surfaceY,
        (body.southBand.minZ + body.southBand.maxZ) / 2,
      );
    mesh.renderOrder = 1;
    group.add(mesh);
  }
  return { group, depthAt: createDepthAt(heightAt) };
};

export { createDepthAt, createWater, isWaterStandable, waterBodies };
export type { HeightSampler, WaterBody };
