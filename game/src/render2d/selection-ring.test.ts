import { describe, expect, it, vi } from 'vitest';
import { TILE_PX } from './placement.js';
import { drawSelectionRing } from './selection-ring.js';

describe('selection ring', () => {
  it('centres the ring on the tile using TILE_PX', () => {
    const context = {
      strokeStyle: '',
      lineWidth: 0,
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    drawSelectionRing(context, 2, 3, '#123456');
    expect(context.ellipse).toHaveBeenCalledWith(
      2 * TILE_PX,
      3 * TILE_PX + 4,
      7,
      3,
      0,
      0,
      Math.PI * 2,
    );
  });

  it('draws one ring at the given tile in the given colour', () => {
    const context = {
      strokeStyle: '',
      lineWidth: 0,
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    drawSelectionRing(context, 2, 3, '#123456');
    expect(context.strokeStyle).toBe('#123456');
    expect(context.beginPath).toHaveBeenCalledOnce();
    expect(context.ellipse).toHaveBeenCalledWith(32, 52, 7, 3, 0, 0, Math.PI * 2);
    expect(context.stroke).toHaveBeenCalledOnce();
  });
});
