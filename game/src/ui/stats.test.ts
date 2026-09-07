import { describe, expect, it } from 'vitest';
import { percentile } from './stats.js';
describe('percentiles', () => {
  it('finds p50 and p95 by nearest rank', () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    expect([percentile(values, 0.5), percentile(values, 0.95)]).toEqual([10, 19]);
  });
  it('returns zero with no samples', () => expect(percentile([], 0.95)).toBe(0));
});
