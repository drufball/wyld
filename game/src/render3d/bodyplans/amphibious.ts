import * as THREE from 'three';
import { materials, mesh, model, motion } from './common.js';
import type { BodyPlanBuilder } from './types.js';
const build: BodyPlanBuilder = (spec) => {
  const { length: l, height: h } = spec.visual,
    m = materials(spec),
    group = new THREE.Group();
  const torso = mesh(new THREE.BoxGeometry(l * 0.55, h * 0.3, l), m.primary, true, true);
  torso.position.y = h * 0.32;
  group.add(torso);
  const legs: THREE.Mesh[] = [];
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const leg = mesh(
        new THREE.CylinderGeometry(l * 0.035, l * 0.05, l * 0.38, 8),
        m.secondary,
        false,
      );
      leg.rotation.z = Math.PI / 2;
      leg.position.set(x * l * 0.36, h * 0.18, z * l * 0.3);
      legs.push(leg);
      group.add(leg);
    }
  const fins: THREE.Mesh[] = [];
  m.accent.side = THREE.DoubleSide;
  for (let i = 0; i < 4; i++) {
    const fin = mesh(new THREE.PlaneGeometry(l * 0.16, h * 0.28), m.accent, false);
    fin.position.set(0, h * 0.57, l * (i / 4 - 0.35));
    fin.rotation.y = Math.PI / 2;
    fins.push(fin);
    group.add(fin);
  }
  const phase = l * 0.29;
  return model(group, (t, state, depth) => {
    const p = motion(t, state, phase),
      swim = depth > 0.4;
    torso.position.set(
      0,
      h * (0.32 + 0.025 * (swim ? 0 : p.bob)) + Math.min(depth, h) * (swim ? 1 : 0),
      l * 0.25 * p.lunge,
    );
    torso.scale.y = 1 + (state === 'idle' && !swim ? 0.03 : 0) * p.bob;
    legs.forEach((leg, i) => {
      leg.rotation.x = swim
        ? (i === 0 || i === 3 ? 0.6 : -0.6) * p.wave
        : state === 'locomotion'
          ? (i === 0 || i === 3 ? 0.45 : -0.45) * p.wave
          : 0;
    });
    fins.forEach((fin, i) => (fin.rotation.z = (swim ? 0.25 : 0.05) * Math.sin(t * 6 - i)));
  });
};
export { build };
