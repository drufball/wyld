import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { TileGrid } from '../world/tiles.js';
import { createCover } from './cover.js';

type Snapshot = {
  meshCount: number;
  trunkCount: number;
  rockCount: number;
  treeKinds: string[];
  trunkMatrices: number[][];
};

const treeTiles = new Set(['-2,-2', '0,0', '3,3']);
const rockTiles = new Set(['-1,2', '2,-1']);
const grid = {
  tileAt: (x: number, y: number) => {
    const key = `${x},${y}`;
    return {
      class: treeTiles.has(key) || rockTiles.has(key) ? 'cover' : 'walkable',
      surface: treeTiles.has(key) ? 'tree' : rockTiles.has(key) ? 'rock' : 'grass',
      biome: 'forest',
    };
  },
} as TileGrid;

const snapshot = (): Snapshot => {
  const scene = new THREE.Scene();
  const cover = createCover(grid, scene);
  cover.build({ x: 0, y: 0 }, 2, 2);
  const meshes = scene.children.filter(
    (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
  );
  const trunk = meshes.find((mesh) => mesh.geometry.type === 'CylinderGeometry')!;
  const rock = meshes.find((mesh) => mesh.geometry.type === 'DodecahedronGeometry')!;
  const treeKinds = meshes
    .filter(
      (mesh) =>
        mesh.geometry.type === 'ConeGeometry' || mesh.geometry.type === 'IcosahedronGeometry',
    )
    .map((mesh) => `${mesh.geometry.type}:${mesh.count}`);
  const matrix = new THREE.Matrix4();
  const trunkMatrices = Array.from({ length: trunk.count }, (_, index) => {
    trunk.getMatrixAt(index, matrix);
    return matrix.toArray();
  });
  const result = {
    meshCount: meshes.length,
    trunkCount: trunk.count,
    rockCount: rock.count,
    treeKinds,
    trunkMatrices,
  };
  cover.dispose();
  return result;
};

describe('cover', () => {
  it('instances known cover counts and deterministically chooses and scales trees', () => {
    const first = snapshot();
    const second = snapshot();
    expect(first.meshCount).toBeLessThanOrEqual(7);
    expect(first.trunkCount).toBe(treeTiles.size);
    expect(first.rockCount).toBe(rockTiles.size);
    expect(first.treeKinds).toEqual(second.treeKinds);
    expect(first.trunkMatrices).toEqual(second.trunkMatrices);

    const scales = first.trunkMatrices.map((elements) =>
      new THREE.Matrix4()
        .fromArray(elements)
        .decompose(new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3()),
    );
    expect(scales).toHaveLength(treeTiles.size);
  });
});
