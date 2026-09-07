import { describe, expect, it, vi } from 'vitest';
import type { PixelSprite } from '@wyld/sprites';
import { blitSprite } from './sprite-canvas.js';

const sprite: PixelSprite = {
  width: 2,
  height: 2,
  palette: ['transparent', '#111111', '#222222'],
  grid: new Uint8Array([1, 0, 2, 1]),
};

function recordingCanvas(context: CanvasRenderingContext2D | null) {
  return { width: 0, height: 0, getContext: vi.fn(() => context) } as unknown as HTMLCanvasElement;
}

describe('blitSprite', () => {
  it('paints one scaled rectangle per opaque pixel', () => {
    const context = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
    blitSprite(recordingCanvas(context as unknown as CanvasRenderingContext2D), sprite, 3);
    expect(context.fillRect.mock.calls).toEqual([
      [0, 0, 3, 3],
      [0, 3, 3, 3],
      [3, 3, 3, 3],
    ]);
  });

  it('skips palette index 0', () => {
    const context = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
    blitSprite(recordingCanvas(context as unknown as CanvasRenderingContext2D), sprite, 2);
    expect(context.fillRect).not.toHaveBeenCalledWith(2, 0, 2, 2);
  });

  it('sizes the canvas to the sprite times the scale', () => {
    const context = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: '' };
    const canvas = recordingCanvas(context as unknown as CanvasRenderingContext2D);
    blitSprite(canvas, sprite, 4);
    expect([canvas.width, canvas.height]).toEqual([8, 8]);
  });

  it('does nothing when the canvas has no 2d context', () => {
    const canvas = recordingCanvas(null);
    expect(() => blitSprite(canvas, sprite, 2)).not.toThrow();
    expect([canvas.width, canvas.height]).toEqual([4, 4]);
  });
});
