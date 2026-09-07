import { describe, expect, it } from 'vitest';
import { createRng } from '../engine/rng.js';
import {
  canHearPlayer,
  canSeePlayer,
  hasLineOfSight,
  reactionFor,
  releaseBehaviour,
  stepDetection,
  visionRange,
} from './ai.js';
const grid = (blocked = new Set<string>()) => ({
  blocksSight: (x: number, y: number) => blocked.has(`${x},${y}`),
});
describe('creature detection', () => {
  it('sees the player inside the 120 degree cone and not outside it', () => {
    expect(canSeePlayer(grid(), { x: 0, y: 0 }, { x: 0, y: 5 }, 0, 'Bold')).toBe(true);
    expect(canSeePlayer(grid(), { x: 0, y: 0 }, { x: 0, y: -5 }, 0, 'Bold')).toBe(false);
  });
  it('ranges vision by temperament in tiles', () => {
    expect(visionRange('Skittish')).toBe(15);
    expect(visionRange('Bold')).toBe(10);
  });
  it('blocks line of sight through cover and cliff tiles but not water', () => {
    expect(hasLineOfSight(grid(new Set(['0,2'])), { x: 0, y: 0 }, { x: 0, y: 4 })).toBe(false);
    expect(hasLineOfSight(grid(), { x: 0, y: 0 }, { x: 0, y: 4 })).toBe(true);
  });
  it('hears a moving player within four tiles', () => expect(canHearPlayer(4, true)).toBe(true));
  it('hears nothing from a player standing still', () =>
    expect(canHearPlayer(1, false)).toBe(false));
  it('clamps detection', () => {
    const visible = { distance: 0, visionRange: 10, visible: true };
    expect(stepDetection(0.99, visible, 10)).toBe(1);
    expect(stepDetection(0.01, { ...visible, visible: false }, 10)).toBe(0);
  });
  it('rerolls Erratic reactions for each detection', () => {
    const flee = { seed: () => 1, next: () => 0.49, range: () => 0, int: () => 0 };
    const aggro = { seed: () => 1, next: () => 0.51, range: () => 0, int: () => 0 };
    expect(reactionFor('Erratic', flee)).toBe('flee');
    expect(reactionFor('Erratic', aggro)).toBe('aggro');
  });
  it('keeps reactions and release tuning', () => {
    expect(reactionFor('Skittish', createRng(1))).toBe('flee');
    expect(reactionFor('Bold', createRng(1))).toBe('aggro');
    expect(reactionFor('Steady', createRng(1))).toBe('hold');
    expect(releaseBehaviour('flee', 1, 10, 1, true)).toBe('wander');
    expect(releaseBehaviour('hold', 11, 10, 1)).toBe('wander');
    expect(releaseBehaviour('aggro', 1, 10, 0)).toBe('wander');
  });
});
