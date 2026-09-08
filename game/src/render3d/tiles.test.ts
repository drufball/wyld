import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Tile, TileGrid } from '../world/tiles.js';
import { paletteAt } from '../render2d/palette.js';
import { createSlabs, jitter } from './tiles.js';
const tileAt = (x: number, y: number): Tile => {
  void y;
  return {
    class: x === 0 ? 'water' : x === 1 ? 'cliff' : 'walkable',
    surface: x === 0 ? 'water' : x === 1 ? 'cliff' : 'grass',
    biome: 'forest',
  };
};
const grid = { tileAt } as TileGrid;
describe('slabs', () => {
  it('creates one instanced mesh per surface class present on the screen', () => {
    const scene = new THREE.Scene(),
      s = createSlabs(grid, scene);
    s.recolour(paletteAt('Day', 0));
    s.build({ x: 0, y: 0 }, 2, 2);
    const meshes = scene.children.filter(
      (x): x is THREE.InstancedMesh => x instanceof THREE.InstancedMesh,
    );
    expect(meshes).toHaveLength(3);
    expect(scene.children.filter((x) => x instanceof THREE.Mesh)).toHaveLength(4);
    expect(meshes.reduce((n, m) => n + m.count, 0)).toBe(36);
    s.dispose();
  });
  it('sits every slab top at its surface height with the tile centred at i + 0.5', () => {
    const scene = new THREE.Scene(),
      s = createSlabs(grid, scene);
    s.build({ x: 0, y: 0 }, 2, 2);
    for (const mesh of scene.children.filter(
      (x): x is THREE.InstancedMesh => x instanceof THREE.InstancedMesh,
    )) {
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(0, m);
      const p = new THREE.Vector3(),
        q = new THREE.Quaternion(),
        scale = new THREE.Vector3();
      m.decompose(p, q, scale);
      expect(Math.abs(p.x % 1)).toBeCloseTo(0.5);
      expect(Math.abs(p.z % 1)).toBeCloseTo(0.5);
      const surface = mesh.userData.surface as string,
        top = p.y + scale.y / 2;
      expect(top).toBeCloseTo(surface === 'water' ? -0.3 : surface === 'cliff' ? 0.6 : 0);
    }
    s.dispose();
  });
  it('uses deterministic, bounded brightness jitter that varies between neighbours', () => {
    expect(jitter(7, 11)).toBe(jitter(7, 11));
    expect(jitter(7, 11)).toBeGreaterThanOrEqual(0.92);
    expect(jitter(7, 11)).toBeLessThanOrEqual(1.08);
    expect(jitter(7, 11)).not.toBe(jitter(8, 11));
  });
});
