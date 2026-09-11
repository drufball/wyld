import * as THREE from 'three';
import { materials, mesh, model, motion } from './common.js';
import type { BodyPlanBuilder } from './types.js';
const build: BodyPlanBuilder = (spec) => {
  const { length: l, height: h } = spec.visual,
    m = materials(spec),
    group = new THREE.Group(),
    segments: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = h * (0.28 - i * 0.012);
    const part = mesh(
      new THREE.SphereGeometry(radius, 8, 6),
      i < 3 ? m.primary : m.secondary,
      i === 0,
    );
    part.scale.set(0.9, 1.9, 1.5);
    part.position.set(0, radius, l * (0.42 - i / 10));
    segments.push(part);
    group.add(part);
  }
  const head = mesh(new THREE.SphereGeometry(h * 0.34, 8, 6), m.primary, false);
  head.name = 'head';
  head.position.set(0, h * 0.34, l * 0.56);
  group.add(head);
  for (const x of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(h * 0.045, 6, 4), m.accent, false);
    eye.position.set(x * h * 0.2, h * 0.1, h * 0.28);
    head.add(eye);
  }
  const phase = l * 0.17;
  return model(group, (t, state) => {
    const p = motion(t, state, phase),
      amp = state === 'locomotion' ? h * 0.55 : state === 'execute' ? h * 0.08 : h * 0.22,
      freq = state === 'locomotion' ? 7 : 3;
    segments.forEach((part, i) => {
      const wave = Math.sin((t + phase) * freq - i * 0.65);
      part.position.x = wave * amp;
      part.position.y = h * (0.28 - i * 0.012) + wave * amp * 0.25;
      part.position.z =
        l * (0.42 - i / 10) + (state === 'execute' ? l * 0.25 * p.lunge * (1 - i / 12) : 0);
    });
    head.position.set(Math.sin((t + phase) * freq) * amp, h * 0.34, l * (0.56 + 0.25 * p.lunge));
    head.rotation.x = -0.25 * p.lunge;
  });
};
export { build };
