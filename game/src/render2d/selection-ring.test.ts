import { describe, expect, it, vi } from 'vitest';
import { drawSelectionRing } from './selection-ring.js';

describe('selection ring', () => {
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
