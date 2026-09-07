import type { BodyPlanId, SpeciesData } from '../species.js';
import { build as amphibious } from './amphibious.js';
import { build as avian } from './avian.js';
import { build as crawler } from './crawler.js';
import { build as heavyQuadruped } from './heavy-quadruped.js';
import { build as largeBiped } from './large-biped.js';
import { build as lightQuadruped } from './light-quadruped.js';
import { build as serpentine } from './serpentine.js';
import { build as shelled } from './shelled.js';
import type { BodyPlanBuilder, CreatureModel } from './types.js';
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
const buildBodyPlan = (species: SpeciesData): CreatureModel =>
  bodyPlanBuilders[species.bodyPlan]({
    palette: species.palette,
    visual: {
      ...species.visual,
      length: species.visual.length!,
      height: species.visual.height!,
    },
  });
export { bodyPlanBuilders, buildBodyPlan };
export type { BodyPlanBuilder, BodyPlanSpec, CreatureModel, CreatureState } from './types.js';
