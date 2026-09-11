import { paintSprite, type BlitOptions } from './blit.js';
import type { PixelSprite } from './types.js';

const spriteCache = new Map<string, HTMLCanvasElement>();

const paintContext = (
  ctx: CanvasRenderingContext2D,
  sprite: PixelSprite,
  palette: readonly string[],
  scale: number,
  flip: boolean,
  x: number,
  y: number,
): void =>
  paintSprite(sprite, palette, scale, flip, (rectX, rectY, width, height, colour) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x + rectX, y + rectY, width, height);
  });

const blitSprite = (
  ctx: CanvasRenderingContext2D,
  sprite: PixelSprite,
  palette: readonly string[],
  options: BlitOptions,
): number => {
  const { x, y, scale = 1, flip = false, cache } = options;
  if (cache === undefined) {
    paintContext(ctx, sprite, palette, scale, flip, x, y);
    return 1;
  }

  const key = `${cache}|${flip}|${scale}`;
  let canvas = spriteCache.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = sprite.width * scale;
    canvas.height = sprite.height * scale;
    const target = canvas.getContext('2d')!;
    paintContext(target, sprite, palette, scale, flip, 0, 0);
    spriteCache.set(key, canvas);
  }
  ctx.drawImage(canvas, x, y);
  return 1;
};

const clearSpriteCache = (): void => spriteCache.clear();

export { blitSprite, clearSpriteCache };
