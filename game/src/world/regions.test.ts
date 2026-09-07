import { describe, expect, it } from 'vitest';

import { pointToRegion, regions } from './regions.js';

describe('pointToRegion', () => {
  it.each([
    [-150, 50, 'hollow'],
    [-220, 160, 'pond-hollow'],
    [200, 60, 'dunes'],
    [0, -390, 'crater-rim'],
    [-390, 390, null],
  ] as const)('maps (%s, %s)', (x, z, expected) => {
    expect(pointToRegion(x, z)?.id ?? null).toBe(expected);
  });

  it('breaks an exact normalised-distance tie by id', () => {
    const a = regions().find((region) => region.id === 'vents');
    const b = regions().find((region) => region.id === 'crater-rim');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    // These two circles overlap; solve along their centre line where d/r is equal.
    const amount = (a?.radius ?? 0) / ((a?.radius ?? 0) + (b?.radius ?? 0));
    const x = (a?.x ?? 0) + ((b?.x ?? 0) - (a?.x ?? 0)) * amount;
    const z = (a?.z ?? 0) + ((b?.z ?? 0) - (a?.z ?? 0)) * amount;
    expect(pointToRegion(x, z)?.id).toBe('crater-rim');
  });
});
