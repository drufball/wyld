import * as THREE from 'three';
import { speciesById } from '../creatures/species.js';
import { trackDecalRects } from '../render2d/track-decal.js';
import { TILE_METRES } from '../world/tiles.js';
import type { TracksPlacement } from '../world/tracks.js';

type Screen = { x: number; y: number };
const createTrackDecals = (scene: THREE.Scene) => {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.7,
    color: '#292b25',
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  let mesh: THREE.InstancedMesh | null = null;
  const clear = () => {
    if (mesh) {
      scene.remove(mesh);
      mesh.dispose();
    }
    mesh = null;
  };
  return {
    build(
      placements: readonly TracksPlacement[],
      screens: readonly Screen[],
      cols: number,
      rows: number,
    ) {
      clear();
      const visible = placements.flatMap((placement) => {
        const tx = Math.floor((placement.x + 400) / TILE_METRES),
          ty = Math.floor((placement.z + 400) / TILE_METRES);
        if (
          !screens.some(
            (screen) =>
              tx >= screen.x * cols - 2 &&
              tx <= (screen.x + 1) * cols + 1 &&
              ty >= screen.y * rows - 2 &&
              ty <= (screen.y + 1) * rows + 1,
          )
        )
          return [];
        const data = speciesById(placement.speciesId);
        return data ? trackDecalRects(data.tracks).map((rect) => ({ rect, tx, ty })) : [];
      });
      if (visible.length === 0) return;
      mesh = new THREE.InstancedMesh(geometry, material, visible.length);
      const matrix = new THREE.Matrix4(),
        position = new THREE.Vector3(),
        quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
        scale = new THREE.Vector3();
      visible.forEach(({ rect, tx, ty }, index) => {
        matrix.compose(
          position.set(
            tx + 0.5 + ((rect.x + rect.w / 2) / 16) * 1.4,
            0.01,
            ty + 0.5 + ((rect.y + rect.h / 2) / 16) * 1.4,
          ),
          quaternion,
          scale.set((rect.w / 16) * 1.4, (rect.h / 16) * 1.4, 1),
        );
        mesh!.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.frustumCulled = false;
      scene.add(mesh);
    },
    dispose() {
      clear();
      geometry.dispose();
      material.dispose();
    },
  };
};
export { createTrackDecals };
