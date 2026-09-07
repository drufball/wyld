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
  screenFlipping?: boolean;
};
type TilePoint = { tx: number; ty: number };
type Screen = { sx: number; sy: number };
const neighborSteps = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
] as const;
const pathForTap = (
  grid: Pick<TileGrid, 'isWalkable'>,
  from: TilePoint,
  target: TilePoint,
  screen: Screen,
  cols: number,
  rows: number,
): readonly TilePoint[] | null => {
  const minTx = screen.sx * cols,
    maxTx = minTx + cols - 1,
    minTy = screen.sy * rows,
    maxTy = minTy + rows - 1,
    onLeft = target.tx === minTx,
    onRight = target.tx === maxTx,
    onTop = target.ty === minTy,
    onBottom = target.ty === maxTy,
    edgeCount = Number(onLeft || onRight) + Number(onTop || onBottom),
    bounds = { minTx, maxTx, minTy, maxTy };

  // A non-corner edge tap asks to cross the screen. Search nearest-first along
  // that edge, preferring the lower coordinate just as findPath does on ties.
  if (edgeCount === 1) {
    const vertical = onLeft || onRight,
      along = vertical ? target.ty : target.tx,
      minimum = vertical ? minTy : minTx,
      maximum = vertical ? maxTy : maxTx;
    for (let distance = 0; distance <= maximum - minimum; distance++) {
      const coordinates = distance === 0 ? [along] : [along - distance, along + distance];
      for (const coordinate of coordinates) {
        if (coordinate < minimum || coordinate > maximum) continue;
        const edge = vertical
            ? { tx: target.tx, ty: coordinate }
            : { tx: coordinate, ty: target.ty },
          across = {
            tx: edge.tx + (onLeft ? -1 : onRight ? 1 : 0),
            ty: edge.ty + (onTop ? -1 : onBottom ? 1 : 0),
          };
        if (!grid.isWalkable(edge.tx, edge.ty) || !grid.isWalkable(across.tx, across.ty)) continue;
        const found = findPath(grid, from, across, { ...bounds, across });
        if (found) return found;
      }
    }
  }

  const destinations = grid.isWalkable(target.tx, target.ty)
    ? [target]
    : neighborSteps.map(([dx, dy]) => ({ tx: target.tx + dx, ty: target.ty + dy }));
  for (const destination of destinations) {
    if (!grid.isWalkable(destination.tx, destination.ty)) continue;
    const found = findPath(grid, from, destination, bounds);
    if (found) return found;
  }
  return null;
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
    const found = pathForTap(
      o.grid,
      { tx: Math.floor(tx), ty: Math.floor(ty) },
      target,
      screen,
      o.cols(),
      o.rows(),
    );
    if (found) path = found;
  };
  const moveTo = (target: TilePoint): void => {
    const found = pathForTap(
      o.grid,
      { tx: Math.floor(tx), ty: Math.floor(ty) },
      target,
      screen,
      o.cols(),
      o.rows(),
    );
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
      if (o.screenFlipping !== false && (next.sx !== screen.sx || next.sy !== screen.sy))
        slide = { from: screen, to: next, progress: 0 };
    } else {
      tx += (dx / d) * step;
      ty += (dy / d) * step;
    }
  };
  return {
    tap,
    moveTo,
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
export { pathForTap };
export type { ControllerOptions, Facing };
