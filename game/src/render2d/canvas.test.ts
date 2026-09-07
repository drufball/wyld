import { describe, expect, it } from 'vitest';
import { canvasPixelToTile, pixelScale, screenCols, screenOf, screenRows } from './canvas.js';
describe('2D viewport', () => {
  it('derives a 11 by 22 tile screen at 2x on a 375 by 812 phone', () => {
    const s = pixelScale(375, 812);
    expect([s, screenCols(375, s), screenRows(812, s)]).toEqual([2, 11, 22]);
  });
  it('derives a 20 by 12 tile screen at 3x on a 1280 by 720 desktop', () => {
    const s = pixelScale(1280, 720);
    expect([s, screenCols(1280, s), screenRows(720, s)]).toEqual([3, 20, 12]);
  });
  it('maps a tile to its screen index', () =>
    expect(screenOf(21, 25, 20, 12)).toEqual({ sx: 1, sy: 2 }));
  it('maps a canvas pixel to a tile on the current screen', () =>
    expect(canvasPixelToTile(17, 33, 2, 3, 20, 12)).toEqual({ tx: 41, ty: 38 }));
});
