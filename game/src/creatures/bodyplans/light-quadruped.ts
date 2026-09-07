import * as THREE from 'three';
import { materials, mesh, model, motion } from './common.js';
import type { BodyPlanBuilder } from './types.js';
const build: BodyPlanBuilder = (spec) => {
  const { length: l, height: h } = spec.visual,
    m = materials(spec),
    group = new THREE.Group();
  const torso = mesh(new THREE.CapsuleGeometry(l * 0.16, l * 0.5, 3, 8), m.primary, true);
  torso.rotation.x = Math.PI / 2;
  torso.position.y = h * 0.62;
  group.add(torso);
  const head = mesh(new THREE.ConeGeometry(l * 0.17, l * 0.4, 8), m.secondary);
  head.rotation.x = Math.PI / 2;
  head.position.set(0, h * 0.78, l * 0.55);
  group.add(head);
  const tail = mesh(new THREE.ConeGeometry(l * 0.09, l * 0.7, 8), m.accent);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, h * 0.65, -l * 0.62);
  group.add(tail);
  const legs: THREE.Mesh[] = [];
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const leg = mesh(new THREE.CylinderGeometry(l * 0.035, l * 0.045, h * 0.5, 8), m.secondary);
      leg.position.set(x * l * 0.14, h * 0.25, z * l * 0.25);
      legs.push(leg);
      group.add(leg);
    }
  const phase = l * 0.51;
  return model(group, (t, state) => {
    const p = motion(t, state, phase);
    torso.position.y = h * (0.62 + 0.025 * p.bob);
    torso.position.z = l * 0.25 * p.lunge;
    torso.scale.y = 1 + (state === 'idle' ? 0.03 : 0) * p.bob;
    head.rotation.x = Math.PI / 2 - 0.2 * p.wave - 0.4 * p.lunge;
    tail.rotation.z = (state === 'locomotion' ? 0.35 : 0.12) * p.wave;
    legs.forEach(
      (leg, i) =>
        (leg.rotation.x =
          state === 'locomotion'
            ? (i % 2 ? -0.65 : 0.65) * p.wave
            : state === 'execute'
              ? 0.3 * p.lunge
              : 0),
    );
  });
};
export { build };
