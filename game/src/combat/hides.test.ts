import { describe, expect, it } from 'vitest';
import { hideMultiplier, resistance, weakness } from './hides.js';
import type { Force } from './moves.js';
describe('hide table', () => {
  it('returns weakness, resistance and neutral multipliers across all pairs', () => {
    const hides = ['Bark', 'Shell', 'Scale', 'Hide', 'Stone'] as const,
      forces: Force[] = ['Impact', 'Cut', 'Heat', 'Surge'];
    for (const hide of hides)
      for (const force of forces)
        expect(hideMultiplier(hide, force)).toBe(
          force === weakness(hide) ? 1.6 : force === resistance(hide) ? 0.6 : 1,
        );
  });
});
