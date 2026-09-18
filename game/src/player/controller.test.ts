import { describe, expect, it } from 'vitest';
import { worldToTile } from '../world/tiles.js';
import { createPlayerController, lerpTile, pathForTap } from './controller.js';

const grid = (blocked: string[] = []) => ({
  isWalkable: (tx: number, ty: number) =>
    tx >= 0 && ty >= 0 && tx < 12 && ty < 12 && !blocked.includes(`${tx},${ty}`),
});
describe('player tile position', () => {
  it('converts its world start to a tile', () =>
    expect(worldToTile(-150, 50)).toEqual({ tx: 125, ty: 225 }));
});

describe('tap destinations', () => {
  it('walks to the first reachable orthogonal neighbour of blocked cover', () => {
    const path = pathForTap(
      grid(['4,4']),
      { tx: 2, ty: 4 },
      { tx: 4, ty: 4 },
      { sx: 0, sy: 0 },
      8,
      8,
    );
    expect(path?.at(-1)).toEqual({ tx: 4, ty: 3 });
  });

  it('skips an unreachable neighbour of blocked cover', () => {
    const blocked = ['4,4', '4,2', '3,3', '5,3'];
    const path = pathForTap(
      grid(blocked),
      { tx: 2, ty: 4 },
      { tx: 4, ty: 4 },
      { sx: 0, sy: 0 },
      8,
      8,
    );
    expect(path?.at(-1)).toEqual({ tx: 3, ty: 4 });
  });

  it('searches along a blocked edge and crosses at the nearest clear pair', () => {
    const blocked = ['7,4', '8,4', '7,3'];
    const path = pathForTap(
      grid(blocked),
      { tx: 4, ty: 4 },
      { tx: 7, ty: 4 },
      { sx: 0, sy: 0 },
      8,
      8,
    );
    expect(path?.at(-1)).toEqual({ tx: 8, ty: 5 });
  });

  it('does not cross either edge when a corner is tapped', () => {
    const path = pathForTap(grid(), { tx: 4, ty: 4 }, { tx: 7, ty: 7 }, { sx: 0, sy: 0 }, 8, 8);
    expect(path?.at(-1)).toEqual({ tx: 7, ty: 7 });
  });

  it('falls back to an adjacent tile when every crossing on an edge is blocked', () => {
    const blocked = Array.from({ length: 8 }, (_, ty) => `8,${ty}`).concat('7,4');
    const path = pathForTap(
      grid(blocked),
      { tx: 4, ty: 4 },
      { tx: 7, ty: 4 },
      { sx: 0, sy: 0 },
      8,
      8,
    );
    expect(path?.at(-1)).toEqual({ tx: 7, ty: 3 });
  });
});
describe('render interpolation', () => {
  it('interpolates between simulation steps', () =>
    expect(lerpTile({ x: 1, y: 2 }, { x: 3, y: 6 }, 0.5)).toEqual({ x: 2, y: 4 }));
  it('clamps alpha and preserves no movement', () => {
    expect(lerpTile({ x: 1, y: 2 }, { x: 3, y: 6 }, 2)).toEqual({ x: 3, y: 6 });
    expect(lerpTile({ x: 1, y: 2 }, { x: 3, y: 6 }, -1)).toEqual({ x: 1, y: 2 });
    expect(lerpTile({ x: 1, y: 2 }, { x: 1, y: 2 }, 0.5)).toEqual({ x: 1, y: 2 });
  });
});

describe('configured movement', () => {
  const controller = (speedTilesPerSecond: number) => {
    const canvas = {
      width: 192,
      height: 192,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 192, height: 192 }),
    } as HTMLCanvasElement;
    return createPlayerController({
      grid: grid() as never,
      canvas,
      cols: () => 12,
      rows: () => 12,
      start: { x: -397, z: -397 },
      screenFlipping: false,
      speedTilesPerSecond,
    });
  };

  it('arrives within a quarter tile of the final waypoint', () => {
    const subject = controller(1);
    subject.moveTo({ tx: 2, ty: 1 });
    for (let i = 0; i < 9; i++) subject.update(0.1);
    expect(subject.tile).toEqual({ x: 2.5, y: 1.5 });
    expect(subject.moving).toBe(false);
  });

  it('does not snap at an intermediate waypoint', () => {
    const subject = controller(1);
    subject.moveTo({ tx: 3, ty: 1 });
    for (let i = 0; i < 9; i++) subject.update(0.1);
    expect(subject.tile.x).toBeCloseTo(2.4);
    expect(subject.moving).toBe(true);
  });

  it('walks at the configured tiles per second', () => {
    const subject = controller(3);
    subject.moveTo({ tx: 4, ty: 1 });
    subject.update(0.2);
    expect(subject.tile.x).toBeCloseTo(2.1);
  });

  it('scales locomotion without moving while held', () => {
    const normal = controller(1);
    const slowed = controller(1);
    const held = controller(1);
    for (const subject of [normal, slowed, held]) subject.moveTo({ tx: 4, ty: 1 });
    normal.update(0.4);
    slowed.update(0.4, 0.75);
    held.update(0.4, 0);
    expect(slowed.tile.x - 1.5).toBeCloseTo((normal.tile.x - 1.5) * 0.75);
    expect(held.tile.x).toBe(1.5);
  });
});
