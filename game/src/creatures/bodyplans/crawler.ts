import * as THREE from 'three';
import { materials, mesh, model, motion } from './common.js';
import type { BodyPlanBuilder } from './types.js';
const build: BodyPlanBuilder = (spec) => {
  const { length: l, height: h } = spec.visual,
    m = materials(spec),
    group = new THREE.Group(),
    parts: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const part = mesh(
      new THREE.BoxGeometry(l * 0.42, h * 0.32, l * 0.28),
      i === 0 ? m.primary : m.secondary,
      i === 3,
    );
    part.position.set(0, h * 0.36, l * (0.36 - i * 0.24));
    parts.push(part);
    group.add(part);
  }
  const legs: THREE.Mesh[] = [];
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const leg = mesh(new THREE.CylinderGeometry(l * 0.025, l * 0.035, l * 0.42, 6), m.secondary);
      leg.rotation.z = Math.PI / 2;
      leg.position.set(side * l * 0.3, h * 0.2, l * (0.27 - i * 0.26));
      legs.push(leg);
      group.add(leg);
    }
  for (const side of [-1, 1]) {
    const jaw = mesh(new THREE.ConeGeometry(l * 0.055, l * 0.28, 8), m.accent);
    jaw.rotation.x = Math.PI / 2;
    jaw.rotation.z = side * 0.25;
    jaw.position.set(side * l * 0.1, h * 0.34, l * 0.65);
    group.add(jaw);
  }
  const phase = l * 0.23;
  return model(group, (t, state) => {
    const p = motion(t, state, phase);
    parts.forEach((part, i) => {
      part.position.y = h * (0.36 + 0.025 * p.bob);
      part.position.x = Math.sin(t * 4 - i) * h * 0.05;
      part.position.z = l * (0.36 - i * 0.24 + 0.25 * p.lunge);
    });
    legs.forEach(
      (leg, i) =>
        (leg.rotation.x =
          state === 'locomotion'
            ? (i % 2 ? -0.65 : 0.65) * p.wave
            : state === 'execute'
              ? 0.5 * p.lunge
              : 0),
    );
  });
};
export { build };
