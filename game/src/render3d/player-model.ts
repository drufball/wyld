import * as THREE from 'three';
import type { Facing } from '../player/controller.js';

const createPlayerModel = () => {
  const group = new THREE.Group();
  const material = (color: string) => new THREE.MeshLambertMaterial({ color, flatShading: true });
  const coat = material('#6d7f5c'),
    trousers = material('#4a4436'),
    skin = material('#d8b48c'),
    satchelMaterial = material('#8a6f4a');
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.28, 3, 8), coat),
    head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), skin),
    satchel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.1), satchelMaterial);
  torso.position.set(0, 0.57, 0);
  head.position.set(0, 0.82, 0.035);
  satchel.position.set(0.2, 0.48, 0.03);
  const limbs = ([-1, 1] as const).map((side) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.34, 7), trousers);
    leg.position.set(side * 0.09, 0.18, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.36, 7), coat);
    arm.position.set(side * 0.22, 0.55, 0.02);
    return { leg, arm, side };
  });
  group.add(torso, head, satchel, ...limbs.flatMap(({ leg, arm }) => [leg, arm]));
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.castShadow = true;
  });
  return {
    group,
    animate(t: number, moving: boolean) {
      group.position.y = moving ? 0 : Math.sin(t * Math.PI) * 0.02;
      const wave = Math.sin(t * Math.PI * 6);
      for (const { leg, arm, side } of limbs) {
        leg.rotation.x = moving ? side * wave * 0.55 : 0;
        arm.rotation.x = moving ? -side * wave * 0.55 : side * Math.sin(t * 2) * 0.08;
      }
    },
    face(facing: Facing) {
      group.rotation.y = { down: 0, up: Math.PI, right: -Math.PI / 2, left: Math.PI / 2 }[facing];
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      for (const entry of [coat, trousers, skin, satchelMaterial]) entry.dispose();
    },
  };
};
export { createPlayerModel };
