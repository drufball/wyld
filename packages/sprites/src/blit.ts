import type { PixelSprite } from './types.js';

type BlitOptions = { x: number; y: number; scale?: number; flip?: boolean; cache?: string };
type PaintRect = (x: number, y: number, width: number, height: number, colour: string) => void;

const paintSprite = (
  sprite: PixelSprite,
  palette: readonly string[],
  scale: number,
  flip: boolean,
  paint: PaintRect,
): void => {
  for (let py = 0; py < sprite.height; py++)
    for (let px = 0; px < sprite.width; px++) {
      const index = sprite.grid[py * sprite.width + px] ?? 0;
      if (!index) continue;
      paint(
        (flip ? sprite.width - 1 - px : px) * scale,
        py * scale,
        scale,
        scale,
        palette[index] ?? '#000',
      );
    }
};

export { paintSprite };
export type { BlitOptions, PaintRect };
