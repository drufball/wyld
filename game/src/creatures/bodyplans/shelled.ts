import * as THREE from 'three';
import { materials, mesh, model, motion } from './common.js';
import type { BodyPlanBuilder } from './types.js';
const build: BodyPlanBuilder = (spec) => {
  const { length: l, height: h } = spec.visual,
    m = materials(spec),
    group = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(l * 0.55, h * 0.25, l * 0.75), m.secondary, true);
  body.position.y = h * 0.28;
  group.add(body);
  const shell = mesh(
    new THREE.SphereGeometry(l * 0.42, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    m.primary,
  );
  shell.scale.set(1, h / (l * 0.6), 1.15);
  shell.position.y = h * 0.3;
  group.add(shell);
  const neck = new THREE.Group();
  neck.position.set(0, h * 0.27, l * 0.43);
  group.add(neck);
  const head = mesh(new THREE.SphereGeometry(h * 0.18, 8, 6), m.secondary);
  head.position.z = l * 0.22;
  neck.add(head);
  const legs: THREE.Mesh[] = [];
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const leg = mesh(new THREE.CylinderGeometry(l * 0.06, l * 0.07, h * 0.25, 8), m.secondary);
      leg.position.set(x * l * 0.25, h * 0.125, z * l * 0.25);
      legs.push(leg);
      group.add(leg);
    }
  const phase = l * 0.41;
  return model(group, (t, state) => {
    const p = motion(t, state, phase);
    body.position.y = h * (0.28 + 0.02 * p.bob);
    body.position.z = l * 0.2 * p.lunge;
    neck.position.z = l * (0.43 - 0.3 * p.lunge);
    head.rotation.x = -0.2 * p.wave;
    legs.forEach(
      (leg, i) => (leg.rotation.x = state === 'locomotion' ? (i % 2 ? -0.35 : 0.35) * p.wave : 0),
    );
  });
};
export { build };
