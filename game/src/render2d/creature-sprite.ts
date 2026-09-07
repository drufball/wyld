import { generateSprite, type SpriteFacing, type SpriteFrame } from '../creatures/sprites/index.js';
import { speciesById } from '../creatures/species.js';
const cache = new Map<string, HTMLCanvasElement>();
const drawCreatureSprite = (
  ctx: CanvasRenderingContext2D,
  speciesId: string,
  facing: SpriteFacing,
  frame: SpriteFrame,
  x: number,
  y: number,
  flip = false,
): number => {
  const key = `${speciesId}:${facing}:${frame}:${flip}`;
  let canvas = cache.get(key);
  if (!canvas) {
    const data = speciesById(speciesId);
    if (!data) return 0;
    const sprite = generateSprite(data, facing, frame);
    canvas = document.createElement('canvas');
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const target = canvas.getContext('2d')!;
    for (let py = 0; py < sprite.height; py++)
      for (let px = 0; px < sprite.width; px++) {
        const index = sprite.grid[py * sprite.width + px]!;
        if (index) {
          target.fillStyle = sprite.palette[index]!;
          target.fillRect(flip ? sprite.width - 1 - px : px, py, 1, 1);
        }
      }
    cache.set(key, canvas);
  }
  ctx.drawImage(canvas, x, y);
  return 1;
};
export { drawCreatureSprite };
