import { describe, expect, it } from 'vitest';
import {
  hideLine,
  hideMultiplier,
  resistance,
  RESISTANCE_MULTIPLIER,
  shrugsOffLine,
  weakness,
  WEAKNESS_MULTIPLIER,
} from './hides.js';
import type { Force } from './moves.js';
describe('hide table', () => {
  it('pins the hide multipliers at 1.6 and 0.6', () => {
    expect(WEAKNESS_MULTIPLIER).toBe(1.6);
    expect(RESISTANCE_MULTIPLIER).toBe(0.6);
  });

  it('writes a hide line naming what it shrugs off and what it fears', () => {
    expect(hideLine('Stone')).toBe('Stone hide — shrugs off Impact, fears Surge');
    expect(hideLine('Hide')).toBe('Hide — shrugs off Surge, fears Cut');
  });

  it('writes a shrugs-off line for a hide', () => {
    expect(shrugsOffLine('Hide')).toBe('shrugs off Surge');
  });
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
