import { describe, expect, it } from 'vitest';
import { lineClear, nearSideOf } from './line.js';

const from = { x: 0.5, y: 0.5 };
const to = { x: 6.5, y: 0.5 };

describe('combat line', () => {
  it('is clear across open ground', () => {
    expect(lineClear(from, to, () => true)).toBe(true);
  });

  it('is blocked by a rock tile on the segment', () => {
    expect(lineClear(from, to, (x, y) => !(x === 3 && y === 0))).toBe(false);
  });

  it('is clear when the rock is off the line', () => {
    expect(lineClear(from, to, (x, y) => !(x === 3 && y === 1))).toBe(true);
  });

  it("ignores the shooter's and the target's own tiles", () => {
    expect(lineClear(from, to, (x, y) => !((x === 0 || x === 6) && y === 0))).toBe(true);
  });

  it('reports the near side of the first rock as the last clear tile centre', () => {
    expect(nearSideOf(from, to, (x, y) => !(x === 3 && y === 0))).toEqual({ x: 2.5, y: 0.5 });
    expect(nearSideOf(from, to, () => true)).toBeNull();
  });
});
