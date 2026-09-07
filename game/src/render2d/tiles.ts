import type { Palette } from './palette.js';
import type { TileGrid } from '../world/tiles.js';
import type { TracksPlacement } from '../world/tracks.js';
import { speciesById } from '../creatures/species.js';
type Entry = { canvas: HTMLCanvasElement; cost: number };
const rgb = (c: readonly number[]) => `rgb(${c.join(',')})`;
const createTileRenderer = (grid: TileGrid, tracks: readonly TracksPlacement[] = []) => {
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
    const id = `${sx},${sy},${cols},${rows},${key}`;
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
        const marks = tile.surface === 'water' || tile.surface === 'sand' ? 2 : 3;
        for (let i = 0; i < marks; i++) {
          hash = (hash * 1664525 + 1013904223) >>> 0;
          const mx = x * 16 + 2 + (hash % 11),
            my = y * 16 + 3 + ((hash >>> 8) % 9);
          if (tile.surface === 'water' || tile.surface === 'sand') ctx.fillRect(mx, my, 4, 1);
          else ctx.fillRect(mx, my, 1, 2);
        }
        if (tile.surface === 'tree' || tile.surface === 'rock' || tile.surface === 'cliff') {
          ctx.fillStyle = rgb(colours.shade);
          ctx.fillRect(x * 16 + 2, y * 16 + 12, 13, 3);
          ctx.fillStyle = rgb(colours.detail);
          if (tile.surface === 'tree') {
            if (hash & 1) {
              ctx.beginPath();
              ctx.arc(x * 16 + 8, y * 16 + 7, 6, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.beginPath();
              ctx.moveTo(x * 16 + 8, y * 16 + 1);
              ctx.lineTo(x * 16 + 2, y * 16 + 13);
              ctx.lineTo(x * 16 + 14, y * 16 + 13);
              ctx.fill();
            }
          } else if (tile.surface === 'cliff') {
            ctx.fillRect(x * 16 + 1, y * 16 + 4, 14, 5);
            ctx.fillRect(x * 16 + 4, y * 16 + 9, 11, 4);
          } else ctx.fillRect(x * 16 + 3, y * 16 + 5, 11, 8);
        }
      }
    ctx.fillStyle = '#292b25aa';
    for (const track of tracks) {
      const tx = Math.floor((track.x + 400) / 2),
        ty = Math.floor((track.z + 400) / 2);
      const x = tx - sx * cols,
        y = ty - sy * rows;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const descriptor = speciesById(track.speciesId)?.tracks;
      const px = x * 16 + 8,
        py = y * 16 + 9;
      if (descriptor?.kind === 'feather') {
        ctx.fillRect(px - 3, py, 7, 1);
        ctx.fillRect(px, py - 3, 1, 6);
      } else if (descriptor?.kind === 'shard') {
        ctx.fillRect(px, py - 3, 1, 6);
        ctx.fillRect(px - 1, py - 1, 3, 3);
      } else if (descriptor?.kind === 'furrow') {
        ctx.fillRect(px - 4, py - 1, 9, 1);
        ctx.fillRect(px - 3, py + 2, 8, 1);
      } else if (descriptor?.kind === 'coil') {
        ctx.fillRect(px - 3, py - 2, 6, 1);
        ctx.fillRect(px - 4, py - 1, 1, 3);
        ctx.fillRect(px - 3, py + 2, 6, 1);
      } else {
        const toes = descriptor?.toes ?? 2;
        for (let i = 0; i < toes; i++) ctx.fillRect(px - 3 + i * 2, py - 2, 1, 2);
        ctx.fillRect(px - 2, py + 2, 2, 1);
        ctx.fillRect(px + 2, py + 1, 2, 1);
        if (descriptor?.drag) ctx.fillRect(px, py, 1, 5);
      }
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
