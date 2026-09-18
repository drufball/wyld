import { draw as amphibious } from './amphibious.js';
import { draw as avian } from './avian.js';
import { draw as crawler } from './crawler.js';
import { draw as heavyQuadruped } from './heavy-quadruped.js';
import { draw as largeBiped } from './large-biped.js';
import { draw as lightQuadruped } from './light-quadruped.js';
import { draw as serpentine } from './serpentine.js';
import { draw as shelled } from './shelled.js';
import type { Painter, PixelSprite, SpriteFacing, SpriteFrame, SpriteSpec } from './types.js';
// Body plans are listed twice on purpose: pixel painters here, mesh builders in game/src/render3d/bodyplans/index.ts — adding a body plan means touching both (parity test: game/src/render3d/bodyplans/index.test.ts).
const bodyPlanPainters: Record<SpriteSpec['bodyPlan'], Painter> = {
  'heavy-quadruped': heavyQuadruped,
  'light-quadruped': lightQuadruped,
  avian,
  amphibious,
  serpentine,
  shelled,
  crawler,
  'large-biped': largeBiped,
};
const generateSprite = (spec: SpriteSpec, facing: SpriteFacing, frame: SpriteFrame): PixelSprite =>
  bodyPlanPainters[spec.bodyPlan](spec, facing, frame);
export { bodyPlanPainters, generateSprite };
export { paintSprite } from './blit.js';
export type { BlitOptions, PaintRect } from './blit.js';
export { blitSprite, clearSpriteCache } from './blit-canvas.js';
export type { PixelSprite, SpriteFacing, SpriteFrame, SpriteSpec } from './types.js';
export * from './species.js';
export * from './validate.js';
export type { Region, ShipResult, SpeciesData, SpeciesDraft, SpeciesLibrary } from './schemas.js';
