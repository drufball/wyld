import { describe, expect, it } from 'vitest';

import { createRng } from '../engine/rng.js';
import { detectionRate, hasCover, reactionFor, stepDetection, visionRange } from './ai.js';

describe('creature detection', () => {
  it('uses temperament vision ranges', () => {
    expect(visionRange('Skittish')).toBe(30);
    expect((['Bold', 'Steady', 'Erratic'] as const).map(visionRange)).toEqual([20, 20, 20]);
  });
  it('matches the detection formula and stance table', () => {
    expect(
      detectionRate({
        distance: 20,
        visionRange: 20,
        stance: 'walk',
        moving: false,
        hasCover: false,
      }),
    ).toBeCloseTo(0.048);
    expect(
      detectionRate({
        distance: 0,
        visionRange: 20,
        stance: 'sprint',
        moving: false,
        hasCover: false,
      }),
    ).toBeCloseTo(0.24);
    expect(
      detectionRate({
        distance: 10,
        visionRange: 20,
        stance: 'crouch',
        moving: false,
        hasCover: false,
      }),
    ).toBeCloseTo(0.0252);
  });
  it('orders stances and movement by visibility', () => {
    const rate = (stance: 'walk' | 'sprint' | 'crouch', moving: boolean) =>
      detectionRate({ distance: 10, visionRange: 20, stance, moving, hasCover: false });
    expect(rate('crouch', false)).toBeLessThan(rate('walk', false));
    expect(rate('walk', false)).toBeLessThan(rate('sprint', false));
    expect(rate('walk', true)).toBeGreaterThan(rate('walk', false));
  });
  it('decays behind cover and beyond range', () => {
    expect(
      detectionRate({
        distance: 0,
        visionRange: 20,
        stance: 'sprint',
        moving: true,
        hasCover: true,
      }),
    ).toBe(-0.25);
    expect(
      detectionRate({
        distance: 21,
        visionRange: 20,
        stance: 'sprint',
        moving: true,
        hasCover: false,
      }),
    ).toBe(-0.25);
  });
  it('clamps the meter at both ends', () => {
    const visible = {
      distance: 0,
      visionRange: 20,
      stance: 'sprint' as const,
      moving: true,
      hasCover: false,
    };
    expect(stepDetection(0.99, visible, 10)).toBe(1);
    expect(stepDetection(0.01, { ...visible, hasCover: true }, 10)).toBe(0);
  });
  it('selects and rerolls temperament reactions', () => {
    expect(reactionFor('Skittish', createRng(1))).toBe('flee');
    expect(reactionFor('Bold', createRng(1))).toBe('aggro');
    expect(reactionFor('Steady', createRng(1))).toBe('hold');
    const rng = createRng(194);
    const rolls = Array.from({ length: 1000 }, () => reactionFor('Erratic', rng));
    const fleeing = rolls.filter((roll) => roll === 'flee').length;
    expect(fleeing).toBeGreaterThanOrEqual(450);
    expect(fleeing).toBeLessThanOrEqual(550);
    expect(rolls.some((roll, index) => index > 0 && roll !== rolls[index - 1])).toBe(true);
  });
});

describe('hasCover', () => {
  const eye = { x: 0, y: 2, z: 0 };
  const target = { x: 10, y: 2, z: 0 };
  it('detects terrain and props between the endpoints', () => {
    expect(hasCover(eye, target, (x) => (x > 4 && x < 6 ? 3 : 0), [])).toBe(true);
    expect(hasCover(eye, target, () => 0, [{ x: 5, z: 0.4, radius: 0.5, height: 3 }])).toBe(true);
  });
  it('ignores props beside or behind the segment', () => {
    expect(hasCover(eye, target, () => 0, [{ x: 5, z: 1, radius: 0.5, height: 3 }])).toBe(false);
    expect(hasCover(eye, target, () => 0, [{ x: 12, z: 0, radius: 1, height: 3 }])).toBe(false);
  });
});
