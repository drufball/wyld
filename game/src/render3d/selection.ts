import * as THREE from 'three';
type SelectionEntry = { tileX: number; tileY: number; colour: string };
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
      material.color.set(entry.colour);
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
