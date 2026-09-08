import * as THREE from 'three';
import { speciesById } from '../creatures/species.js';

type SelectionEntry = { speciesId: string; tileX: number; tileY: number };
const createSelection = (scene: THREE.Scene) => {
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 24), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.visible = false;
  scene.add(mesh);
  return {
    sync(entry: SelectionEntry | null) {
      mesh.visible = entry !== null;
      if (!entry) return;
      const data = speciesById(entry.speciesId);
      material.color.set(data?.palette.accent ?? '#bd7132');
      mesh.position.x = entry.tileX;
      mesh.position.z = entry.tileY;
    },
    dispose() {
      scene.remove(mesh);
      mesh.geometry.dispose();
      material.dispose();
    },
  };
};
export { createSelection };
