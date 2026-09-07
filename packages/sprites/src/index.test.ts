import { describe, expect, it } from 'vitest';
import {
  BODY_PLANS,
  BODY_PLAN_DELIVERIES,
  HIDES,
  HIDE_TABLE,
  TIER_BANDS,
  generateSprite,
  type SpriteSpec,
} from './index.js';
const fixture = (bodyPlan: SpriteSpec['bodyPlan'], tier: SpriteSpec['tier'] = 1): SpriteSpec => ({
  bodyPlan,
  tier,
  palette: { primary: '#112233', secondary: '#445566', accent: '#778899' },
  visual: { length: 1, height: 1 },
});
describe('sprites package', () => {
  it('generates a non-empty sprite for each of the eight body plans', () => {
    for (const plan of BODY_PLANS)
      expect(generateSprite(fixture(plan), 'down', 'idle').grid.some(Boolean)).toBe(true);
  });
  it('sizes sprites 16, 24 and 32 pixels by tier', () => {
    expect(
      [1, 2, 3].map((t) => generateSprite(fixture('avian', t as 1 | 2 | 3), 'down', 'idle').width),
    ).toEqual([16, 24, 32]);
  });
  it('is deterministic for the same spec, facing and frame', () => {
    const spec = fixture('crawler');
    expect(generateSprite(spec, 'side', 'walk0').grid).toEqual(
      generateSprite(spec, 'side', 'walk0').grid,
    );
  });
  it('exports a hide, delivery and tier-band table for every body plan and hide', () => {
    expect(HIDES.every((h) => HIDE_TABLE[h])).toBe(true);
    expect(BODY_PLANS.every((p) => BODY_PLAN_DELIVERIES[p].length > 0)).toBe(true);
    expect(Object.keys(TIER_BANDS)).toHaveLength(3);
  });
});
