import type { PlayerSprite } from './player-sprite.js';
const cache = new Map<string, HTMLCanvasElement>();
const blit = (
  ctx: CanvasRenderingContext2D,
  sprite: PlayerSprite,
  x: number,
  y: number,
  flipX = false,
): number => {
  const key = `${sprite.key}:${flipX}`;
  let canvas = cache.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const target = canvas.getContext('2d')!;
    for (let py = 0; py < sprite.height; py++)
      for (let px = 0; px < sprite.width; px++) {
        const index = sprite.grid[py * sprite.width + px] ?? 0;
        if (!index) continue;
        target.fillStyle = sprite.palette[index] ?? '#000';
        target.fillRect(flipX ? sprite.width - 1 - px : px, py, 1, 1);
      }
    cache.set(key, canvas);
  }
  ctx.drawImage(canvas, x, y);
  return 1;
};
export { blit };
