import { describe, expect, it } from 'vitest';
import { worldToTile } from '../world/tiles.js';
import { pathForTap } from './controller.js';

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
