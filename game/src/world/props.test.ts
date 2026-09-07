import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { createRng } from '../engine/rng.js';
import worldData from '../data/world.json';
import { createProps, placeProps } from './props.js';
import { createTerrain } from './terrain.js';
import { createWater } from './water.js';
import type { PropDensities, PropKind } from './props.js';
import type { BiomeWeights } from './terrain.js';

const densities = (active: PropKind): PropDensities => ({
  conifer: { density: active === 'conifer' ? 4 : 0, scale: [1, 2] },
  broadleaf: { density: active === 'broadleaf' ? 4 : 0, scale: [1, 2] },
  fern: { density: active === 'fern' ? 4 : 0, scale: [1, 2] },
  rock: { density: active === 'rock' ? 4 : 0, scale: [1, 2] },
  cactus: { density: active === 'cactus' ? 4 : 0, scale: [1, 2] },
  mesa: { density: active === 'mesa' ? 4 : 0, scale: [1, 2] },
  vent: { density: active === 'vent' ? 4 : 0, scale: [1, 2] },
});
const weights = (biome: keyof BiomeWeights): BiomeWeights => ({
  forest: biome === 'forest' ? 1 : 0,
  desert: biome === 'desert' ? 1 : 0,
  archipelago: biome === 'archipelago' ? 1 : 0,
  volcano: biome === 'volcano' ? 1 : 0,
});
const sample = (
  kind: PropKind,
  overrides: Partial<{
    slopeAt(x: number, z: number): number;
    depthAt(x: number, z: number): number;
    biomeWeightsAt(x: number, z: number): BiomeWeights;
  }> = {},
) =>
  placeProps({
    rng: createRng(194),
    heightAt: () => 7,
    slopeAt: () => 0,
    depthAt: () => 0,
    biomeWeightsAt: () =>
      weights(
        kind === 'cactus' || kind === 'mesa' ? 'desert' : kind === 'vent' ? 'volcano' : 'forest',
      ),
    densities: densities(kind),
    bounds:
      kind === 'mesa'
        ? { minX: 240, maxX: 260, minZ: -190, maxZ: -170 }
        : { minX: 0, maxX: 20, minZ: 0, maxZ: 20 },
    ...overrides,
  });

describe('placeProps', () => {
  it('is deterministic for a fixed seed', () => {
    expect(sample('conifer')).toEqual(sample('conifer'));
  });

  it('rejects slopes over 30 degrees', () => {
    expect(sample('conifer', { slopeAt: () => 30.01 })).toEqual([]);
  });

  it('rejects water, while allowing rocks in at most 0.2 metres', () => {
    expect(sample('conifer', { depthAt: () => 0.01 })).toEqual([]);
    expect(sample('rock', { depthAt: () => 0.2 })).not.toEqual([]);
    expect(sample('rock', { depthAt: () => 0.201 })).toEqual([]);
  });

  it('rejects candidates outside each kind biome mask', () => {
    expect(sample('cactus', { biomeWeightsAt: () => weights('forest') })).toEqual([]);
    expect(sample('conifer', { biomeWeightsAt: () => weights('volcano') })).toEqual([]);
    expect(sample('vent', { biomeWeightsAt: () => weights('desert') })).toEqual([]);
  });
});

it('keeps terrain, water, and props at Shore Camp below the in-view triangle budget', () => {
  const terrain = createTerrain(194);
  const water = createWater(terrain.heightAt);
  const placements = placeProps({
    rng: createRng(194),
    heightAt: terrain.heightAt,
    slopeAt: terrain.slopeAt,
    depthAt: water.depthAt,
    biomeWeightsAt: terrain.biomeWeightsAt,
    densities: worldData.props,
    bounds: { minX: -400, maxX: 400, minZ: -400, maxZ: 400 },
  });
  const viewpoint = new THREE.Object3D();
  viewpoint.position.set(-100, 0, 345);
  const props = createProps(placements, viewpoint);
  const groups = [terrain.group, water.group, props];
  let triangles = 0;
  for (const group of groups) group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry;
    triangles +=
      ((geometry.index?.count ?? geometry.getAttribute('position').count) / 3) *
      (object instanceof THREE.InstancedMesh ? object.count : 1);
  });
  expect(triangles).toBeLessThanOrEqual(190_000);
});
