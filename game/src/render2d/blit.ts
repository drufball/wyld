import type { PixelSprite } from './player-sprite.js';
const blit = (
  ctx: CanvasRenderingContext2D,
  sprite: PixelSprite,
  x: number,
  y: number,
  flipX = false,
): number => {
  let calls = 0;
  for (let py = 0; py < sprite.height; py++)
    for (let px = 0; px < sprite.width; px++) {
      const index = sprite.grid[py * sprite.width + px] ?? 0;
      if (!index) continue;
      ctx.fillStyle = sprite.palette[index] ?? '#000';
      ctx.fillRect(x + (flipX ? sprite.width - 1 - px : px), y + py, 1, 1);
      calls++;
    }
  return calls;
};
export { blit };
