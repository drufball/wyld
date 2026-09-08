import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createProjectiles } from './projectiles.js';

const projectile = (x = 1) => ({ position: { x, y: 2 } });
const flash = (remaining = 1, x = 1) => ({ at: { x, y: 2 }, remaining });
const meshes = (scene: THREE.Scene) =>
  scene.children.filter((child) => child instanceof THREE.InstancedMesh);

describe('createProjectiles', () => {
  it('draws every projectile and flash in two instanced meshes', () => {
    const scene = new THREE.Scene();
    const effects = createProjectiles(scene);
    effects.sync(
      Array.from({ length: 6 }, (_, i) => projectile(i)),
      Array.from({ length: 3 }, (_, i) => flash(1, i)),
      0,
    );
    expect(meshes(scene)).toHaveLength(2);
    expect(meshes(scene).map(({ count }) => count)).toEqual([6, 3]);
    effects.dispose();
  });

  it('grows its capacity without reallocating every frame', () => {
    const scene = new THREE.Scene();
    const effects = createProjectiles(scene);
    effects.sync(Array.from({ length: 4 }, projectile), [], 0);
    const geometry = meshes(scene)[0]!.geometry;
    effects.sync(Array.from({ length: 20 }, projectile), [], 0);
    expect(meshes(scene)[0]!.geometry).toBe(geometry);
    expect(meshes(scene)[0]!.count).toBe(20);
    const grownMesh = meshes(scene)[0];
    effects.sync(Array.from({ length: 5 }, projectile), [], 0);
    expect(meshes(scene)[0]).toBe(grownMesh);
    expect(meshes(scene)[0]!.geometry).toBe(geometry);
    expect(meshes(scene)[0]!.count).toBe(5);
    effects.dispose();
  });

  it('shrinks a flash as it fades', () => {
    const scene = new THREE.Scene();
    const effects = createProjectiles(scene);
    effects.sync([], [flash(1), flash(0.25, 2)], 0);
    const mesh = meshes(scene)[1]!;
    const full = new THREE.Vector3();
    const faded = new THREE.Vector3();
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), full);
    mesh.getMatrixAt(1, matrix);
    matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), faded);
    expect(faded.x).toBeCloseTo(full.x * 0.25);
    effects.dispose();
  });

  it('keeps both meshes out of the frustum cull', () => {
    const scene = new THREE.Scene();
    const effects = createProjectiles(scene);
    effects.sync([projectile()], [flash()], 0);
    for (const mesh of meshes(scene)) {
      expect(mesh.frustumCulled).toBe(false);
      expect(mesh.boundingSphere).not.toBeNull();
    }
    effects.dispose();
  });
});
