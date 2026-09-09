import * as THREE from 'three';

type ProjectileEntry = { position: { x: number; y: number } };
type FlashEntry = { at: { x: number; y: number }; remaining: number };
type Pool = {
  mesh: THREE.InstancedMesh;
  geometry: THREE.IcosahedronGeometry;
  material: THREE.MeshBasicMaterial;
  capacity: number;
};

const capacityFor = (count: number) => Math.max(16, Math.ceil(count / 16) * 16);
const createPool = (
  scene: THREE.Scene,
  radius: number,
  material: THREE.MeshBasicMaterial,
): Pool => {
  const geometry = new THREE.IcosahedronGeometry(radius, 0);
  const mesh = new THREE.InstancedMesh(geometry, material, 16);
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, geometry, material, capacity: 16 };
};
const grow = (scene: THREE.Scene, pool: Pool, count: number) => {
  if (count <= pool.capacity) return false;
  scene.remove(pool.mesh);
  pool.mesh.dispose();
  pool.capacity = capacityFor(count);
  pool.mesh = new THREE.InstancedMesh(pool.geometry, pool.material, pool.capacity);
  pool.mesh.frustumCulled = false;
  scene.add(pool.mesh);
  return true;
};
const createProjectiles = (scene: THREE.Scene) => {
  const projectiles = createPool(scene, 0.12, new THREE.MeshBasicMaterial({ color: '#f4efd9' }));
  const flashes = createPool(
    scene,
    0.35,
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const write = (
    pool: Pool,
    entries: readonly (ProjectileEntry | FlashEntry)[],
    flash: boolean,
  ) => {
    const grew = grow(scene, pool, entries.length);
    entries.forEach((entry, index) => {
      const point = 'at' in entry ? entry.at : entry.position;
      const size = flash && 'remaining' in entry ? Math.max(0, Math.min(1, entry.remaining)) : 1;
      matrix.compose(
        position.set(point.x, flash ? 0.5 : 0.45, point.y),
        quaternion,
        scale.setScalar(size),
      );
      pool.mesh.setMatrixAt(index, matrix);
    });
    pool.mesh.count = entries.length;
    pool.mesh.instanceMatrix.needsUpdate = true;
    pool.mesh.computeBoundingSphere();
    return grew;
  };
  return {
    sync(
      projectileEntries: readonly ProjectileEntry[],
      flashEntries: readonly FlashEntry[],
      elapsedSeconds: number,
    ) {
      void elapsedSeconds;
      const grewProjectiles = write(projectiles, projectileEntries, false);
      const grewFlashes = write(flashes, flashEntries, true);
      if (grewProjectiles || grewFlashes) {
        scene.remove(projectiles.mesh, flashes.mesh);
        scene.add(projectiles.mesh, flashes.mesh);
      }
    },
    dispose() {
      for (const pool of [projectiles, flashes]) {
        scene.remove(pool.mesh);
        pool.mesh.dispose();
        pool.geometry.dispose();
        pool.material.dispose();
      }
    },
  };
};

export { createProjectiles };
export type { FlashEntry, ProjectileEntry };
