import { describe, expect, it } from 'vitest';
import { createDepthAt, isWaterStandable } from './water.js';

describe('water', () => {
  const bodies = [
    { id: 'test', kind: 'pond' as const, surfaceY: 2, circle: { x: 0, z: 0, radius: 10 } },
  ];
  it('measures depth only inside declared bodies', () => {
    const depthAt = createDepthAt(() => 0.5, bodies);
    expect(depthAt(0, 0)).toBe(1.5);
    expect(depthAt(11, 0)).toBe(0);
    expect(createDepthAt(() => 3, bodies)(0, 0)).toBe(0);
  });
  it('allows up to 0.6 metres and blocks deeper water', () => {
    expect(isWaterStandable(0.6)).toBe(true);
    expect(isWaterStandable(0.6001)).toBe(false);
  });
});
