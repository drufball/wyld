import { describe, expect, it } from 'vitest';
import { pickSpriteAt, spriteOrigin, TILE_PX } from './placement.js';

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

describe('sprite picking', () => {
  it('a tap on the upper half of a tall sprite picks that sprite', () => {
    const sprite = { key: 'tall', tileX: 2, tileY: 3, sizePx: 32 };
    const origin = spriteOrigin(sprite.tileX, sprite.tileY, sprite.sizePx, sprite.sizePx);
    expect(pickSpriteAt(origin.x + 16, origin.y + 4, [sprite], 0)).toBe('tall');
  });
  it('a tap outside the padded rect picks nothing', () => {
    expect(pickSpriteAt(11, 11, [{ key: 'one', tileX: 2, tileY: 2, sizePx: 16 }], 3)).toBeNull();
  });
  it('the nearer sprite wins when two overlap', () => {
    expect(
      pickSpriteAt(
        32,
        32,
        [
          { key: 'far', tileX: 2, tileY: 2, sizePx: 32 },
          { key: 'near', tileX: 2, tileY: 3, sizePx: 32 },
        ],
        0,
      ),
    ).toBe('near');
  });
});
