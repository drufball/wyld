import { describe, expect, it } from 'vitest';

import { spriteOrigin } from './placement.js';
import {
  combatBarOrigin,
  combatFootBarOrigin,
  creatureBarWidth,
  healthColour,
} from './combat-bar.js';

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

describe('combat foot bars', () => {
  it('sits one pixel below the sprite and preserves its x', () => {
    const tile = { x: 5.5, y: 11.21 };
    const sprite = spriteOrigin(tile.x, tile.y, 24, 24);
    expect(combatFootBarOrigin(tile, { x: 0, y: 0 }, 24, 16, 24)).toEqual({
      x: sprite.x,
      y: sprite.y + 25,
    });
  });

  it('matches creature widths by tier', () => {
    expect([creatureBarWidth(1), creatureBarWidth(2), creatureBarWidth(3)]).toEqual([16, 24, 32]);
  });

  it('colours health at the exact thresholds', () => {
    expect([1, 0.51, 0.5, 0.26, 0.24, 0].map((value) => healthColour(value, 1))).toEqual([
      '#6fbf3f',
      '#6fbf3f',
      '#6fbf3f',
      '#e2963a',
      '#d6453a',
      '#d6453a',
    ]);
  });
});
