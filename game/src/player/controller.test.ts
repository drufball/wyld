import { describe, expect, it } from 'vitest';

import { faceYaw } from './controller.js';

describe('faceYaw', () => {
  it('turns the orbit camera view direction towards a world point', () => {
    expect(faceYaw(0, 0, 10, 0)).toBeCloseTo(-Math.PI / 2);
    expect(faceYaw(0, 0, 0, -10)).toBeCloseTo(0);
    expect(faceYaw(5, 5, 5, 15)).toBeCloseTo(Math.PI);
  });
});
