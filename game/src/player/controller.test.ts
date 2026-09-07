import { describe, expect, it } from 'vitest';
import { worldToTile } from '../world/tiles.js';
describe('player tile position', () => {
  it('converts its world start to a tile', () =>
    expect(worldToTile(-150, 50)).toEqual({ tx: 125, ty: 225 }));
});
