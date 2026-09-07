import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import type { Rng } from '../engine/rng.js';
import type { BiomeWeights } from './terrain.js';

const propKinds = ['conifer', 'broadleaf', 'fern', 'rock', 'cactus', 'mesa', 'vent'] as const;
type PropKind = (typeof propKinds)[number];
type PropDensity = { density: number; scale: readonly number[] };
type PropDensities = Record<PropKind, PropDensity>;
type PropBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
type PropPlacement = {
  kind: PropKind;
  x: number;
  z: number;
  y: number;
  rotationY: number;
  scale: number;
};
type PlacePropsOptions = {
  rng: Rng;
  heightAt(x: number, z: number): number;
  slopeAt(x: number, z: number): number;
  depthAt(x: number, z: number): number;
  biomeWeightsAt(x: number, z: number): BiomeWeights;
  densities: PropDensities;
  bounds: PropBounds;
};

const masks: Record<PropKind, readonly (keyof BiomeWeights)[]> = {
  conifer: ['forest'],
  broadleaf: ['forest'],
  fern: ['forest'],
  rock: ['forest', 'archipelago', 'volcano'],
  cactus: ['desert'],
  mesa: ['desert'],
  vent: ['volcano'],
};

/** Pure seeded rejection sampling; all environmental knowledge arrives as samplers. */
const placeProps = (options: PlacePropsOptions): PropPlacement[] => {
  const { rng, heightAt, slopeAt, depthAt, biomeWeightsAt, densities, bounds } = options;
  const area = (bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ);
  const placements: PropPlacement[] = [];
  for (const kind of propKinds) {
    const setting = densities[kind];
    const target = Math.round((setting.density * area) / 1000);
    let accepted = 0;
    for (let attempt = 0; attempt < target * 12 && accepted < target; attempt += 1) {
      const x = rng.range(bounds.minX, bounds.maxX);
      const z = rng.range(bounds.minZ, bounds.maxZ);
      const depth = depthAt(x, z);
      const weights = biomeWeightsAt(x, z);
      const biomeWeight = Math.max(...masks[kind].map((biome) => weights[biome]));
      const nearMesaRegions =
        Math.hypot(x - 250, z + 180) <= 90 || Math.hypot(x - 300, z + 60) <= 80;
      if (
        slopeAt(x, z) > 30 ||
        (kind === 'rock' ? depth > 0.2 : depth > 0) ||
        biomeWeight < 0.58 ||
        (kind === 'mesa' && !nearMesaRegions)
      )
        continue;
      placements.push({
        kind,
        x,
        z,
        y: heightAt(x, z),
        rotationY: rng.range(0, Math.PI * 2),
        scale: rng.range(setting.scale[0] ?? 1, setting.scale[1] ?? setting.scale[0] ?? 1),
      });
      accepted += 1;
    }
  }
  return placements;
};

const translated = (geometry: THREE.BufferGeometry, x: number, y: number, z: number) => {
  geometry.translate(x, y, z);
  return geometry;
};
const merged = (...parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const compatible = parts.map((part) => (part.index ? part.toNonIndexed() : part));
  const result = mergeGeometries(compatible, false);
  if (!result) throw new Error('Could not build prop geometry');
  result.computeVertexNormals();
  return result;
};
const cone = (radius: number, height: number, y: number, vertices = 6) =>
  translated(new THREE.ConeGeometry(radius, height, vertices), 0, y, 0);
const trunk = (radius: number, height: number) =>
  translated(new THREE.CylinderGeometry(radius * 0.72, radius, height, 6), 0, height / 2, 0);

const geometryFor = (kind: PropKind): THREE.BufferGeometry => {
  if (kind === 'conifer')
    return merged(trunk(0.3, 2.5), cone(1.5, 2.4, 2.4), cone(1.2, 2.2, 3.5), cone(0.8, 1.8, 4.5));
  if (kind === 'broadleaf')
    return merged(trunk(0.34, 2.8), translated(new THREE.IcosahedronGeometry(1.55, 0), 0, 3.4, 0));
  if (kind === 'fern') {
    const parts: THREE.BufferGeometry[] = [];
    for (let index = 0; index < 5; index += 1) {
      const blade = new THREE.ConeGeometry(0.18, 1.4, 3);
      blade.rotateZ(Math.PI / 3);
      blade.rotateY((index / 5) * Math.PI * 2);
      blade.translate(
        Math.cos((index / 5) * Math.PI * 2) * 0.45,
        0.35,
        Math.sin((index / 5) * Math.PI * 2) * 0.45,
      );
      parts.push(blade);
    }
    return merged(...parts);
  }
  if (kind === 'rock') {
    const rock = new THREE.IcosahedronGeometry(1, 1);
    const positions = rock.getAttribute('position');
    for (let index = 0; index < positions.count; index += 1)
      positions.setXYZ(
        index,
        positions.getX(index) * (0.85 + (index % 3) * 0.08),
        positions.getY(index) * 0.7,
        positions.getZ(index) * (0.9 + (index % 2) * 0.12),
      );
    rock.computeVertexNormals();
    return rock;
  }
  if (kind === 'cactus') {
    const armA = new THREE.CylinderGeometry(0.14, 0.18, 1.25, 6)
      .rotateZ(Math.PI / 2)
      .translate(0.48, 1.35, 0);
    const armB = new THREE.CylinderGeometry(0.12, 0.16, 0.9, 6)
      .rotateZ(Math.PI / 2)
      .translate(-0.38, 2, 0);
    return merged(trunk(0.3, 3), armA, armB);
  }
  if (kind === 'mesa')
    return merged(
      translated(new THREE.BoxGeometry(4, 2.6, 3.6), 0, 1.3, 0),
      translated(new THREE.BoxGeometry(2.8, 1.8, 2.6), 0.3, 3.5, -0.1),
    );
  return merged(
    cone(0.75, 1.1, 0.55, 7),
    translated(new THREE.CylinderGeometry(0.28, 0.4, 0.75, 7), 0, 0.65, 0),
  );
};

const colours: Record<PropKind, number> = {
  conifer: 0x23482f,
  broadleaf: 0x49763a,
  fern: 0x5c8c4a,
  rock: 0x555552,
  cactus: 0x4f793d,
  mesa: 0x9b512c,
  vent: 0x251f20,
};

const drawDistances: Record<PropKind, number> = {
  conifer: 250,
  broadleaf: 250,
  fern: 120,
  rock: 120,
  cactus: 180,
  mesa: 300,
  vent: 180,
};

const createProps = (
  placements: readonly PropPlacement[],
  viewpoint?: THREE.Object3D,
): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'props';
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (const kind of propKinds) {
    const entries = placements.filter((entry) => entry.kind === kind);
    const material = new THREE.MeshLambertMaterial({ color: colours[kind], flatShading: true });
    if (kind === 'vent') {
      material.emissive.setHex(0xff4b16);
      material.emissiveIntensity = 0.65;
    }
    const mesh = new THREE.InstancedMesh(geometryFor(kind), material, entries.length);
    mesh.name = `props-${kind}`;
    let lastViewX = Number.POSITIVE_INFINITY;
    let lastViewZ = Number.POSITIVE_INFINITY;
    const updateInstances = (): void => {
      if (
        viewpoint &&
        Math.hypot(viewpoint.position.x - lastViewX, viewpoint.position.z - lastViewZ) < 4
      )
        return;
      if (viewpoint) {
        lastViewX = viewpoint.position.x;
        lastViewZ = viewpoint.position.z;
      }
      let visible = 0;
      const distance = drawDistances[kind];
      for (const entry of entries) {
        if (
          viewpoint &&
          Math.hypot(entry.x - viewpoint.position.x, entry.z - viewpoint.position.z) > distance
        )
          continue;
        position.set(entry.x, entry.y, entry.z);
        rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, entry.rotationY);
        scale.setScalar(entry.scale);
        matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(visible, matrix);
        visible += 1;
      }
      mesh.count = visible;
      mesh.instanceMatrix.needsUpdate = true;
    };
    updateInstances();
    mesh.onBeforeRender = updateInstances;
    mesh.castShadow = kind !== 'fern';
    mesh.receiveShadow = true;
    // Instance matrices are repacked around a moving viewpoint, so the batch has no stable bounds.
    mesh.frustumCulled = !viewpoint;
    if (!viewpoint) mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
};

export { createProps, drawDistances, placeProps, propKinds };
export type { PlacePropsOptions, PropBounds, PropDensities, PropDensity, PropKind, PropPlacement };
