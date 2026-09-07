import type { Palette } from './palette.js';
import type { TileGrid } from '../world/tiles.js';
type Entry = { canvas: HTMLCanvasElement; cost: number };
const rgb = (c: readonly number[]) => `rgb(${c.join(',')})`;
const createTileRenderer = (grid: TileGrid) => {
  const cache = new Map<string, Entry>();
  let lastRebuildMs = 0;
  const layer = (
    sx: number,
    sy: number,
    cols: number,
    rows: number,
    palette: Palette,
    key: string,
  ) => {
    const id = `${sx},${sy},${key}`;
    const hit = cache.get(id);
    if (hit) {
      cache.delete(id);
      cache.set(id, hit);
      return hit.canvas;
    }
    const started = performance.now(),
      canvas = document.createElement('canvas');
    canvas.width = cols * 16;
    canvas.height = rows * 16;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const tx = sx * cols + x,
          ty = sy * rows + y,
          tile = grid.tileAt(tx, ty),
          colours = palette[tile.surface];
        ctx.fillStyle = rgb(colours.base);
        ctx.fillRect(x * 16, y * 16, 16, 16);
        let hash = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
        ctx.fillStyle = rgb(colours.detail);
        for (let i = 0; i < 4; i++) {
          hash = (hash * 1664525 + 1013904223) >>> 0;
          ctx.fillRect(x * 16 + (hash & 15), y * 16 + ((hash >>> 8) & 15), 1, 1);
        }
        ctx.fillStyle = rgb(colours.shade);
        ctx.fillRect(x * 16, y * 16 + 15, 16, 1);
      }
    lastRebuildMs = performance.now() - started;
    cache.set(id, { canvas, cost: lastRebuildMs });
    while (cache.size > 4) cache.delete(cache.keys().next().value!);
    return canvas;
  };
  return {
    layer,
    get tileMs() {
      return lastRebuildMs;
    },
    clear: () => cache.clear(),
  };
};
export { createTileRenderer };
