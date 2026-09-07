import { describe, expect, it } from 'vitest';
import { skyAt } from './sky.js';

describe('sky interpolation', () => {
  it('returns distinct phase endpoint lighting', () => {
    const endpoints = [0, 0.25, 0.5, 0.75].map(skyAt);
    expect(endpoints.map((state) => state.sunIntensity)).toEqual([1.5, 3, 1.35, 0.7]);
    expect(endpoints[1]!.background.b).toBeGreaterThan(endpoints[3]!.background.b);
  });
  it('interpolates monotonically at a midpoint', () => {
    const dawn = skyAt(0);
    const middle = skyAt(0.125);
    const day = skyAt(0.25);
    expect(middle.sunIntensity).toBeGreaterThan(dawn.sunIntensity);
    expect(middle.sunIntensity).toBeLessThan(day.sunIntensity);
    expect(middle.fogFar).toBeGreaterThan(dawn.fogFar);
  });
});
