import { describe, expect, it } from 'vitest';
import { FOG_CELLS, cellCentre, cellIndexAt, createFog } from './fog.js';

describe('guide fog', () => {
  it('maps world corners and centre and rejects positions outside the world', () => {
    expect(cellIndexAt(-400, -400)).toBe(0);
    expect(cellIndexAt(400, -400)).toBe(39);
    expect(cellIndexAt(-400, 400)).toBe(1560);
    expect(cellIndexAt(400, 400)).toBe(1599);
    expect(cellIndexAt(0, 0)).toBe(820);
    expect(cellIndexAt(400.01, 0)).toBeNull();
    expect(cellIndexAt(0, -400.01)).toBeNull();
  });

  it('reveals the explicit thirteen-cell circle around a cell centre', () => {
    const fog = createFog();
    expect(fog.reveal(10, 10)).toEqual([
      740, 779, 780, 781, 818, 819, 820, 821, 822, 859, 860, 861, 900,
    ]);
    expect(fog.revealedCount()).toBe(13);
    expect(fog.reveal(10, 10)).toEqual([]);
    expect(cellCentre(820)).toEqual({ x: 10, z: 10 });
  });

  it('reveals every cell and serialises it in stable order', () => {
    const fog = createFog([4, 2]);
    fog.revealAll();
    expect(fog.revealedCount()).toBe(FOG_CELLS);
    expect(fog.toJSON()).toEqual(Array.from({ length: 1600 }, (_, index) => index));
  });
});
