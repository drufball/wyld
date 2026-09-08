import * as THREE from 'three';
import { materials, mesh, model, motion } from './common.js';
import type { BodyPlanBuilder } from './types.js';
const build: BodyPlanBuilder = (spec) => {
  const { length: l, height: h } = spec.visual,
    w = spec.visual.wingspan ?? l * 2,
    m = materials(spec),
    group = new THREE.Group(),
    bodyRoot = new THREE.Group();
  group.add(bodyRoot);
  const body = mesh(new THREE.CapsuleGeometry(l * 0.18, l * 0.35, 3, 8), m.primary, true, true);
  body.rotation.x = Math.PI / 2;
  body.position.y = h * 0.55;
  bodyRoot.add(body);
  const beak = mesh(new THREE.ConeGeometry(l * 0.1, l * 0.3, 8), m.accent, false);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, h * 0.65, l * 0.43);
  bodyRoot.add(beak);
  const wings: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const wing = mesh(new THREE.BoxGeometry(w * 0.45, h * 0.06, l * 0.4), m.secondary, false);
    wing.position.set(side * w * 0.24, h * 0.62, 0);
    wings.push(wing);
    bodyRoot.add(wing);
  }
  const phase = l * 0.73;
  return model(group, (t, state) => {
    const p = motion(t, state, phase),
      hover = state === 'idle' ? 0 : h * (0.6 + Math.sin((t + phase) * Math.PI) * 0.15);
    bodyRoot.position.set(0, hover, l * 0.25 * p.lunge);
    body.position.y = h * (0.55 + 0.025 * p.bob);
    body.scale.y = 1 + (state === 'idle' ? 0.03 : 0) * p.bob;
    wings.forEach((wing, i) => {
      const idle = state === 'idle';
      wing.scale.x = idle ? 0.5 : 1;
      wing.rotation.z = idle
        ? i
          ? -0.15
          : 0.15
        : (i ? -1 : 1) * Math.sin((t + phase) * Math.PI * 8) * 0.75;
    });
    beak.rotation.x = Math.PI / 2 - 0.4 * p.lunge;
  });
};
export { build };
