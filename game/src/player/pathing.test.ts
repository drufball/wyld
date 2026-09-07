import { describe, expect, it } from 'vitest';
import { findPath } from './pathing.js';
const grid = (blocked: string[] = []): { isWalkable(x: number, y: number): boolean } => ({
  isWalkable: (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8 && !blocked.includes(`${x},${y}`),
});
describe('pathing', () => {
  it('finds a four-directional path across open tiles', () =>
    expect(findPath(grid(), { tx: 0, ty: 0 }, { tx: 2, ty: 2 })).toHaveLength(4));
  it('walks around a wall of cover tiles', () =>
    expect(
      findPath(grid(['1,0', '1,1']), { tx: 0, ty: 0 }, { tx: 2, ty: 0 })?.length,
    ).toBeGreaterThan(2));
  it('returns null for an unwalkable target', () =>
    expect(findPath(grid(['2,2']), { tx: 0, ty: 0 }, { tx: 2, ty: 2 })).toBeNull());
  it('returns null when the target is unreachable', () =>
    expect(findPath(grid(['1,0', '0,1']), { tx: 0, ty: 0 }, { tx: 2, ty: 2 })).toBeNull());
  it('returns the same path for the same tap', () =>
    expect(findPath(grid(), { tx: 0, ty: 0 }, { tx: 3, ty: 3 })).toEqual(
      findPath(grid(), { tx: 0, ty: 0 }, { tx: 3, ty: 3 }),
    ));
  it('keeps diagonals off by default', () =>
    expect(findPath(grid(), { tx: 0, ty: 0 }, { tx: 1, ty: 1 })).toHaveLength(2));
  it('uses one root-two diagonal when enabled', () =>
    expect(
      findPath(
        grid(),
        { tx: 0, ty: 0 },
        { tx: 1, ty: 1 },
        { minTx: 0, maxTx: 7, minTy: 0, maxTy: 7, diagonals: true },
      ),
    ).toHaveLength(1));
  it('refuses a diagonal past blocked orthogonal tiles', () =>
    expect(
      findPath(
        grid(['1,0', '0,1']),
        { tx: 0, ty: 0 },
        { tx: 1, ty: 1 },
        { minTx: 0, maxTx: 7, minTy: 0, maxTy: 7, diagonals: true },
      ),
    ).toBeNull());
});
