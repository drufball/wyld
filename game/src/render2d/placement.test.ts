import { describe, expect, it } from 'vitest';
import { spriteOrigin, TILE_PX } from './placement.js';

describe('spriteOrigin', () => {
  it.each([
    [16, 16, 80, 128],
    [24, 24, 76, 120],
    [32, 32, 72, 112],
    [16, 24, 80, 120],
  ])('grounds a %i by %i sprite', (width, height, x, y) => {
    const origin = spriteOrigin(5.5, 8.5, width, height);

    expect(origin).toEqual({ x, y });
    expect(origin.x + width / 2).toBe(5.5 * TILE_PX);
    expect(origin.y + height).toBe(8.5 * TILE_PX + TILE_PX / 2);
  });
});
