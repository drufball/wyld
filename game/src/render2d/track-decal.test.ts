import { describe, expect, it } from 'vitest';
import { species } from '../creatures/species.js';
import { trackDecalRects } from './track-decal.js';

describe('trackDecalRects', () => {
  it.each(species())('keeps $name tracks legible and inside a tile', ({ tracks }) => {
    const rects = trackDecalRects(tracks);
    const minX = Math.min(...rects.map(({ x }) => x));
    const maxX = Math.max(...rects.map(({ x, w }) => x + w));
    const minY = Math.min(...rects.map(({ y }) => y));
    const maxY = Math.max(...rects.map(({ y, h }) => y + h));

    expect(Math.max(maxX - minX, maxY - minY)).toBeGreaterThanOrEqual(10);
    expect(Math.max(maxX - minX, maxY - minY)).toBeLessThanOrEqual(12);
    for (const { x, y, w, h } of rects) {
      expect(x).toBeGreaterThanOrEqual(-7);
      expect(y).toBeGreaterThanOrEqual(-7);
      expect(x + w).toBeLessThanOrEqual(7);
      expect(y + h).toBeLessThanOrEqual(7);
    }
  });

  it.each([2, 3, 4, 6])('spans the tile without overlapping for %i toes', (toes) => {
    const toeRects = trackDecalRects({ kind: 'prints', toes }).slice(0, toes);
    const sorted = [...toeRects].sort((a, b) => a.x - b.x);

    expect(Math.min(...sorted.map(({ x }) => x))).toBe(-5);
    expect(Math.max(...sorted.map(({ x, w }) => x + w))).toBe(5);
    for (let i = 1; i < sorted.length; i++)
      expect(sorted[i]!.x).toBeGreaterThanOrEqual(sorted[i - 1]!.x + sorted[i - 1]!.w);
  });
});
