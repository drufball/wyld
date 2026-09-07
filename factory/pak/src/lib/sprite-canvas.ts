import type { PixelSprite } from '@wyld/sprites';
export function blitSprite(canvas: HTMLCanvasElement, sprite: PixelSprite, scale: number): void {
  canvas.width = sprite.width * scale;
  canvas.height = sprite.height * scale;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  sprite.grid.forEach((index, position) => {
    if (index !== 0) {
      context.fillStyle = sprite.palette[index]!;
      context.fillRect(
        (position % sprite.width) * scale,
        Math.floor(position / sprite.width) * scale,
        scale,
        scale,
      );
    }
  });
}
