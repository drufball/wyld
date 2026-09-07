import * as THREE from 'three';
import { materials, mesh, model, motion } from './common.js';
import type { BodyPlanBuilder } from './types.js';

const build: BodyPlanBuilder = (spec) => {
  const { length: l, height: h } = spec.visual;
  const m = materials(spec);
  const group = new THREE.Group();
  const torso = mesh(new THREE.BoxGeometry(l * 0.55, h * 0.48, l), m.primary, true);
  torso.position.y = h * 0.62;
  group.add(torso);
  const head = mesh(new THREE.BoxGeometry(l * 0.48, h * 0.42, l * 0.38), m.secondary);
  head.position.set(0, h * 0.82, l * 0.62);
  group.add(head);
  const legs: THREE.Mesh[] = [];
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const leg = mesh(new THREE.CylinderGeometry(l * 0.09, l * 0.11, h * 0.45, 8), m.secondary);
      leg.position.set(x * l * 0.2, h * 0.225, z * l * 0.33);
      legs.push(leg);
      group.add(leg);
    }
  for (const x of [-1, 1]) {
    const horn = mesh(new THREE.ConeGeometry(l * 0.06, l * 0.25, 8), m.accent);
    horn.rotation.x = Math.PI / 2;
    horn.position.set(x * l * 0.14, h * 1.02, l * 0.84);
    group.add(horn);
  }
  const phase = l * 0.37;
  return model(group, (t, state) => {
    const p = motion(t, state, phase);
    torso.position.y = h * (0.62 + 0.025 * p.bob);
    torso.scale.y = 1 + (state === 'idle' ? 0.03 : 0) * p.bob;
    torso.position.z = l * 0.25 * p.lunge;
    head.position.z = l * (0.62 + 0.32 * p.lunge);
    head.rotation.x = -0.12 * p.wave - 0.35 * p.lunge;
    legs.forEach(
      (leg, i) =>
        (leg.rotation.x =
          state === 'locomotion'
            ? (i % 2 ? -0.45 : 0.45) * p.wave
            : state === 'execute'
              ? 0.25 * p.lunge
              : 0),
    );
  });
};
export { build };
