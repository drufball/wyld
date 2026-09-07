import { canvasPixelToTile, crossedScreen, screenOf } from '../render2d/canvas.js';
import { findPath } from './pathing.js';
import { TILES_PER_SIDE, tileToWorld, worldToTile } from '../world/tiles.js';
import type { TileGrid } from '../world/tiles.js';
type Facing = 'down' | 'up' | 'left' | 'right';
type ControllerOptions = {
  grid: TileGrid;
  canvas: HTMLCanvasElement;
  cols(): number;
  rows(): number;
  start?: { x: number; z: number };
};
const createPlayerController = (o: ControllerOptions) => {
  const initial = worldToTile(o.start?.x ?? -150, o.start?.z ?? 50);
  let tx = initial.tx + 0.5,
    ty = initial.ty + 0.5,
    path: readonly { tx: number; ty: number }[] = [],
    facing: Facing = 'down',
    screen = screenOf(initial.tx, initial.ty, o.cols(), o.rows()),
    slide: {
      from: { sx: number; sy: number };
      to: { sx: number; sy: number };
      progress: number;
    } | null = null;
  const tap = (clientX: number, clientY: number) => {
    if (slide) return;
    const rect = o.canvas.getBoundingClientRect(),
      px = ((clientX - rect.left) * o.canvas.width) / rect.width,
      py = ((clientY - rect.top) * o.canvas.height) / rect.height,
      target = canvasPixelToTile(px, py, screen.sx, screen.sy, o.cols(), o.rows());
    if (!o.grid.isWalkable(target.tx, target.ty)) return;
    const localX = target.tx - screen.sx * o.cols();
    const localY = target.ty - screen.sy * o.rows();
    const dx = localX === 0 ? -1 : localX === o.cols() - 1 ? 1 : 0;
    const dy = localY === 0 ? -1 : localY === o.rows() - 1 ? 1 : 0;
    const across = { tx: target.tx + dx, ty: target.ty + dy };
    const crossesOneEdge = Number(dx !== 0) + Number(dy !== 0) === 1;
    const destination = crossesOneEdge && o.grid.isWalkable(across.tx, across.ty) ? across : target;
    const found = findPath(o.grid, { tx: Math.floor(tx), ty: Math.floor(ty) }, destination, {
      minTx: screen.sx * o.cols(),
      maxTx: (screen.sx + 1) * o.cols() - 1,
      minTy: screen.sy * o.rows(),
      maxTy: (screen.sy + 1) * o.rows() - 1,
      across: destination === across ? across : undefined,
    });
    if (found) path = found;
  };
  const update = (dt: number) => {
    const resizedScreen = screenOf(Math.floor(tx), Math.floor(ty), o.cols(), o.rows());
    if (!slide && (resizedScreen.sx !== screen.sx || resizedScreen.sy !== screen.sy))
      screen = resizedScreen;
    if (slide) {
      slide.progress += dt / 0.25;
      if (slide.progress >= 1) {
        screen = slide.to;
        slide = null;
      }
      return;
    }
    const target = path[0];
    if (!target) return;
    const gx = target.tx + 0.5,
      gy = target.ty + 0.5,
      dx = gx - tx,
      dy = gy - ty,
      d = Math.hypot(dx, dy),
      step = 2 * dt;
    facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    if (d <= step) {
      tx = gx;
      ty = gy;
      path = path.slice(1);
      const next = crossedScreen(target.tx, target.ty, screen, o.cols(), o.rows());
      if (next.sx !== screen.sx || next.sy !== screen.sy)
        slide = { from: screen, to: next, progress: 0 };
    } else {
      tx += (dx / d) * step;
      ty += (dy / d) * step;
    }
  };
  return {
    tap,
    update,
    teleport(x: number, z: number) {
      const requested = worldToTile(x, z);
      let p = requested;
      if (!o.grid.isWalkable(p.tx, p.ty)) {
        const queue = [p],
          seen = new Set([`${p.tx},${p.ty}`]);
        while (queue.length) {
          const candidate = queue.shift()!;
          if (o.grid.isWalkable(candidate.tx, candidate.ty)) {
            p = candidate;
            break;
          }
          for (const [dx, dy] of [
            [0, -1],
            [-1, 0],
            [1, 0],
            [0, 1],
          ] as const) {
            const next = { tx: candidate.tx + dx, ty: candidate.ty + dy },
              key = `${next.tx},${next.ty}`;
            if (
              !seen.has(key) &&
              next.tx >= 0 &&
              next.ty >= 0 &&
              next.tx < TILES_PER_SIDE &&
              next.ty < TILES_PER_SIDE
            ) {
              seen.add(key);
              queue.push(next);
            }
          }
        }
      }
      tx = p.tx + 0.5;
      ty = p.ty + 0.5;
      path = [];
      slide = null;
      screen = screenOf(p.tx, p.ty, o.cols(), o.rows());
      return tileToWorld(p.tx, p.ty);
    },
    get tile() {
      return { x: tx, y: ty };
    },
    get world() {
      return tileToWorld(tx - 0.5, ty - 0.5);
    },
    get screen() {
      return { x: screen.sx, y: screen.sy };
    },
    get facing() {
      return facing;
    },
    get sliding() {
      return slide;
    },
    get moving() {
      return path.length > 0;
    },
  };
};
export { createPlayerController };
export type { ControllerOptions, Facing };
