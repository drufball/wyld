import * as THREE from 'three';
import type { BodyPlanId, SpeciesData } from '../../creatures/species.js';
import { build as amphibious } from './amphibious.js';
import { build as avian } from './avian.js';
import { build as crawler } from './crawler.js';
import { build as heavyQuadruped } from './heavy-quadruped.js';
import { build as largeBiped } from './large-biped.js';
import { build as lightQuadruped } from './light-quadruped.js';
import { build as serpentine } from './serpentine.js';
import { build as shelled } from './shelled.js';
import type { BodyPlanBuilder, CreatureModel } from './types.js';
// Body plans are listed twice on purpose: mesh builders here, pixel painters in packages/sprites/src/index.ts — adding a body plan means touching both (parity test: ./index.test.ts).
const bodyPlanBuilders: Record<BodyPlanId, BodyPlanBuilder> = {
  'heavy-quadruped': heavyQuadruped,
  'light-quadruped': lightQuadruped,
  avian,
  amphibious,
  serpentine,
  shelled,
  crawler,
  'large-biped': largeBiped,
};
const TIER_LENGTH_TILES: Record<1 | 2 | 3, number> = { 1: 0.8, 2: 1.2, 3: 1.8 };
const buildBodyPlan = (species: SpeciesData, tier: 1 | 2 | 3): CreatureModel => {
  const inner = bodyPlanBuilders[species.bodyPlan]({
    palette: species.palette,
    visual: {
      ...species.visual,
      length: species.visual.length!,
      height: species.visual.height!,
    },
  });
  const group = new THREE.Group();
  const scale = TIER_LENGTH_TILES[tier] / species.visual.length!;
  inner.group.scale.setScalar(scale);
  group.add(inner.group);
  return {
    group,
    animate: (t, state, waterDepth) => inner.animate(t, state, waterDepth),
    dispose: () => inner.dispose(),
  };
};
export { TIER_LENGTH_TILES, bodyPlanBuilders, buildBodyPlan };
export type { BodyPlanBuilder, BodyPlanSpec, CreatureModel, CreatureState } from './types.js';
