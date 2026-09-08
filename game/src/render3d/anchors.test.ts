import { describe, expect, it } from 'vitest';
import { orthoFrustum, screenCentre } from './camera.js';
import { anchorFor } from './anchors.js';

describe('anchorFor', () => {
  it('puts a head anchor above the foot anchor on screen', () => {
    for (const [width, height] of [
      [1280, 720],
      [375, 812],
    ] as const) {
      const cols = Math.floor(width / 32),
        rows = Math.floor(height / 32);
      const target = screenCentre({ x: 0, y: 0 }, cols, rows),
        frustum = orthoFrustum(cols, rows);
      const rect = { left: 0, top: 0, width, height };
      expect(anchorFor(target.x, target.z, 1, target, frustum, rect).top).toBeLessThan(
        anchorFor(target.x, target.z, 0, target, frustum, rect).top,
      );
    }
  });
  it('anchors the centre tile to the centre of the canvas', () => {
    const cols = 40,
      rows = 22,
      target = screenCentre({ x: 2, y: 3 }, cols, rows);
    const rect = { left: 20, top: 10, width: 1280, height: 720 };
    const anchor = anchorFor(target.x, target.z, 0, target, orthoFrustum(cols, rows), rect);
    expect(anchor.left).toBeCloseTo(rect.left + rect.width / 2, 0);
    expect(anchor.top).toBeCloseTo(rect.top + rect.height / 2, 0);
  });
});
