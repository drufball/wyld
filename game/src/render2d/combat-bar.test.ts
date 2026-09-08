import { describe, expect, it } from 'vitest';

import { spriteOrigin } from './placement.js';
import { combatBarOrigin } from './combat-bar.js';

describe('combatBarOrigin', () => {
  it('puts the enemy bar at the enemy sprite origin', () => {
    const tile = { x: 5.5, y: 11.21 };
    const screen = { x: 0, y: 0 };
    const sprite = spriteOrigin(tile.x, tile.y, 32, 32);

    expect(combatBarOrigin(tile, screen, 24, 16, 32)).toEqual({
      x: sprite.x,
      y: sprite.y - 4,
    });
  });
});
