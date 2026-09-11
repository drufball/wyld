import { draw as amphibious } from './amphibious.js';
import { draw as avian } from './avian.js';
import { draw as crawler } from './crawler.js';
import { draw as heavyQuadruped } from './heavy-quadruped.js';
import { draw as largeBiped } from './large-biped.js';
import { draw as lightQuadruped } from './light-quadruped.js';
import { draw as serpentine } from './serpentine.js';
import { draw as shelled } from './shelled.js';
import type { Painter, PixelSprite, SpriteFacing, SpriteFrame, SpriteSpec } from './types.js';
const painters: Record<SpriteSpec['bodyPlan'], Painter> = {
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
  painters[spec.bodyPlan](spec, facing, frame);
export { generateSprite };
export { paintSprite } from './blit.js';
export type { BlitOptions, PaintRect } from './blit.js';
export { blitSprite, clearSpriteCache } from './blit-canvas.js';
export type { PixelSprite, SpriteFacing, SpriteFrame, SpriteSpec } from './types.js';
export * from './species.js';
export * from './validate.js';
export * from './ship.js';
