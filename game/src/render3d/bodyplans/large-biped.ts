import * as THREE from 'three';
import { materials, mesh, model, motion } from './common.js';
import type { BodyPlanBuilder } from './types.js';
const build: BodyPlanBuilder = (spec) => {
  const { length: l, height: h } = spec.visual,
    m = materials(spec),
    group = new THREE.Group();
  const torso = mesh(new THREE.BoxGeometry(l * 0.55, h * 0.4, l * 0.35), m.primary);
  torso.position.y = h * 0.66;
  group.add(torso);
  const head = mesh(new THREE.BoxGeometry(l * 0.42, h * 0.22, l * 0.38), m.accent, false);
  head.position.set(0, h * 0.93, l * 0.06);
  group.add(head);
  const legs: THREE.Mesh[] = [],
    arms: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const leg = mesh(
      new THREE.CylinderGeometry(l * 0.11, l * 0.14, h * 0.52, 8),
      m.secondary,
      false,
    );
    leg.position.set(side * l * 0.17, h * 0.26, 0);
    legs.push(leg);
    group.add(leg);
    const arm = mesh(new THREE.CapsuleGeometry(l * 0.08, h * 0.38, 3, 8), m.secondary, false);
    arm.position.set(side * l * 0.38, h * 0.63, l * 0.02);
    arms.push(arm);
    group.add(arm);
  }
  const phase = l * 0.13;
  return model(group, (t, state) => {
    const p = motion(t, state, phase);
    torso.position.set(0, h * (0.66 + 0.02 * p.bob), l * 0.25 * p.lunge);
    torso.rotation.x = state === 'execute' ? 0.3 * p.lunge : 0.04 * p.wave;
    head.position.z = l * (0.06 + 0.25 * p.lunge);
    legs.forEach(
      (leg, i) => (leg.rotation.x = state === 'locomotion' ? (i ? -0.55 : 0.55) * p.wave : 0),
    );
    arms.forEach((arm, i) => {
      arm.rotation.x = state === 'execute' ? -1.7 * p.lunge : (i ? 0.55 : -0.55) * p.wave;
      arm.rotation.z = state === 'execute' ? (i ? -0.25 : 0.25) * p.lunge : 0;
    });
  });
};
export { build };
