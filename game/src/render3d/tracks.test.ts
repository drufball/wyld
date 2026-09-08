import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { speciesById } from '../creatures/species.js';
import { trackDecalRects } from '../render2d/track-decal.js';
import type { TracksPlacement } from '../world/tracks.js';
import { createTrackDecals } from './tracks.js';

const placements: TracksPlacement[] = ['thornwren', 'pyreclaw', 'mirefin', 'loamox'].map(
  (speciesId, index) => ({
    speciesId,
    regionId: 'woodland',
    x: -399 + index,
    z: -399,
    y: 0,
    rotationY: 0,
    size: 1,
  }),
);
const instanced = (scene: THREE.Scene) =>
  scene.children.filter(
    (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
  );

describe('createTrackDecals', () => {
  it('draws every track print in a single instanced mesh', () => {
    const scene = new THREE.Scene(),
      decals = createTrackDecals(scene);
    decals.build(placements, [{ x: 0, y: 0 }], 8, 8);
    const meshes = instanced(scene);
    expect(meshes).toHaveLength(1);
    expect(meshes[0]!.count).toBe(
      placements.reduce(
        (total, placement) =>
          total + trackDecalRects(speciesById(placement.speciesId)!.tracks).length,
        0,
      ),
    );
    decals.dispose();
  });
  it('lays every decal flat on the slab top', () => {
    const scene = new THREE.Scene(),
      decals = createTrackDecals(scene);
    decals.build(placements, [{ x: 0, y: 0 }], 8, 8);
    const mesh = instanced(scene)[0]!,
      matrix = new THREE.Matrix4(),
      position = new THREE.Vector3(),
      quaternion = new THREE.Quaternion(),
      scale = new THREE.Vector3(),
      euler = new THREE.Euler();
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, matrix);
      matrix.decompose(position, quaternion, scale);
      euler.setFromQuaternion(quaternion);
      expect(euler.x).toBeCloseTo(-Math.PI / 2);
      expect(position.y).toBeCloseTo(0.01);
    }
    decals.dispose();
  });
});
