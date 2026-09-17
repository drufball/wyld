import { describe, expect, it } from 'vitest';
import {
  canvasPixelToTile,
  crossedScreen,
  pixelScale,
  screenCols,
  screenOf,
  screenRows,
  scaleFromQuery,
} from './canvas.js';
describe('2D viewport', () => {
  it('derives a 7 by 16 tile screen at 3x on a 375 by 812 phone', () => {
    const s = pixelScale(375, 812);
    expect([s, screenCols(375, s), screenRows(812, s)]).toEqual([3, 7, 16]);
  });
  it('derives a 20 by 11 tile screen at 4x on a 1280 by 720 desktop', () => {
    const s = pixelScale(1280, 720);
    expect([s, screenCols(1280, s), screenRows(720, s)]).toEqual([4, 20, 11]);
  });
  it('honours supported forced scales', () => {
    expect([2, 3, 4].map((scale) => pixelScale(375, 812, scale))).toEqual([2, 3, 4]);
    expect([screenCols(375, 2), screenRows(812, 2)]).toEqual([11, 22]);
    expect([screenCols(375, 4), screenRows(812, 4)]).toEqual([5, 12]);
  });
  it('reads only supported scales from the query', () => {
    expect(['?scale=2', '?scale=3', '?scale=4'].map(scaleFromQuery)).toEqual([2, 3, 4]);
    expect(['?scale=5', '?scale=abc', '?scale=', ''].map(scaleFromQuery)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
  it('keeps the flat canvas inside common phone widths', () => {
    for (const [width, height] of [
      [320, 568],
      [375, 812],
      [390, 844],
      [414, 896],
    ]) {
      const scale = pixelScale(width!, height!);
      expect(screenCols(width!, scale) * 16 * scale).toBeLessThanOrEqual(width!);
    }
  });
  it('maps a tile to its screen index', () =>
    expect(screenOf(21, 25, 20, 12)).toEqual({ sx: 1, sy: 2 }));
  it('maps a canvas pixel to a tile on the current screen', () =>
    expect(canvasPixelToTile(17, 33, 2, 3, 20, 12)).toEqual({ tx: 41, ty: 38 }));
  it('flips to the next screen when a step crosses the boundary', () =>
    expect(crossedScreen(20, 4, { sx: 0, sy: 0 }, 20, 15)).toEqual({ sx: 1, sy: 0 }));
  it('does not flip at the world edge', () =>
    expect(crossedScreen(400, 4, { sx: 19, sy: 0 }, 20, 15)).toEqual({ sx: 19, sy: 0 }));
});
