import {
  blitSprite,
  generateSprite,
  type PixelSprite,
  type SpriteFacing,
  type SpriteFrame,
} from '@wyld/sprites';
import { speciesById } from '../creatures/species.js';
const cache = new Map<string, PixelSprite>();
const drawCreatureSprite = (
  ctx: CanvasRenderingContext2D,
  speciesId: string,
  facing: SpriteFacing,
  frame: SpriteFrame,
  x: number,
  y: number,
  flip = false,
): number => {
  const key = `${speciesId}:${facing}:${frame}`;
  let sprite = cache.get(key);
  if (!sprite) {
    const data = speciesById(speciesId);
    if (!data) return 0;
    sprite = generateSprite(data, facing, frame);
    cache.set(key, sprite);
  }
  return blitSprite(ctx, sprite, sprite.palette, { x, y, flip, cache: key });
};
export { drawCreatureSprite };
