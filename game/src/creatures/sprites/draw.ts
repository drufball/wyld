import type { PixelSprite, SpriteSpec } from './types.js';

type Canvas = PixelSprite & { set(x: number, y: number, colour: number): void };
const canvasFor = (spec: SpriteSpec): Canvas => {
  const width = spec.tier === 1 ? 16 : spec.tier === 2 ? 24 : 32;
  const grid = new Uint8Array(width * width);
  return {
    width,
    height: width,
    palette: [
      'transparent',
      spec.palette.primary,
      spec.palette.secondary,
      spec.palette.accent ?? spec.palette.secondary,
    ],
    grid,
    set(x, y, colour) {
      x = Math.round(x);
      y = Math.round(y);
      if (x >= 0 && y >= 0 && x < width && y < width) grid[y * width + x] = colour;
    },
  };
};
const rect = (c: Canvas, x: number, y: number, w: number, h: number, colour = 1): void => {
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) c.set(px, py, colour);
};
const ellipse = (c: Canvas, cx: number, cy: number, rx: number, ry: number, colour = 1): void => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) c.set(x, y, colour);
};
const line = (c: Canvas, x0: number, y0: number, x1: number, y1: number, colour = 1): void => {
  const dx = Math.abs(x1 - x0),
    sx = x0 < x1 ? 1 : -1,
    dy = -Math.abs(y1 - y0),
    sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    c.set(x0, y0, colour);
    if (x0 === x1 && y0 === y1) break;
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x0 += sx;
    }
    if (twice <= dx) {
      error += dx;
      y0 += sy;
    }
  }
};
const variation = (spec: SpriteSpec): number =>
  Math.abs(
    Math.round(Object.values(spec.visual).reduce((sum, value, i) => sum + value * (i + 1) * 7, 0)),
  ) % 3;
export { canvasFor, ellipse, line, rect, variation };
export type { Canvas };
