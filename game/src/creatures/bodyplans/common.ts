import * as THREE from 'three';

import type { BodyPlanSpec, CreatureModel, CreatureState } from './types.js';

type Materials = {
  primary: THREE.MeshLambertMaterial;
  secondary: THREE.MeshLambertMaterial;
  accent: THREE.MeshLambertMaterial;
};
type Pose = (t: number, state: CreatureState, waterDepth: number) => void;

const materials = (spec: BodyPlanSpec): Materials => ({
  primary: new THREE.MeshLambertMaterial({ color: spec.palette.primary, flatShading: true }),
  secondary: new THREE.MeshLambertMaterial({ color: spec.palette.secondary, flatShading: true }),
  accent: new THREE.MeshLambertMaterial({
    color: spec.palette.accent ?? spec.palette.secondary,
    flatShading: true,
  }),
});

const mesh = (
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  receive = false,
): THREE.Mesh => {
  const result = new THREE.Mesh(geometry, material);
  result.castShadow = true;
  result.receiveShadow = receive;
  return result;
};

const model = (group: THREE.Group, pose: Pose): CreatureModel => {
  let disposed = false;
  return {
    group,
    animate: (t, state, waterDepth = 0) => pose(t, state, waterDepth),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      const geometries = new Set<THREE.BufferGeometry>();
      const mats = new Set<THREE.Material>();
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        const entries = Array.isArray(object.material) ? object.material : [object.material];
        entries.forEach((entry) => mats.add(entry));
      });
      geometries.forEach((entry) => entry.dispose());
      mats.forEach((entry) => entry.dispose());
    },
  };
};

const motion = (
  t: number,
  state: CreatureState,
  phase: number,
): { wave: number; lunge: number; bob: number } => {
  const time = t + phase;
  const wave = Math.sin(
    time * Math.PI * (state === 'locomotion' ? 3 : state === 'execute' ? 2.5 : 1),
  );
  const attack = Math.sin(((t % 0.8) / 0.8) * Math.PI);
  return {
    wave,
    lunge: state === 'execute' ? attack : 0,
    bob: state === 'idle' ? Math.sin(time * Math.PI) : Math.abs(wave),
  };
};

export { materials, mesh, model, motion };
