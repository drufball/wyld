import { describe, expect, it } from 'vitest';

import { applyKeyEvent, applyMouseMovement, consumeEdges } from './input.js';
import type { InputState, MouseState } from './input.js';

describe('input state transitions', () => {
  it('tracks key down, key up, and a pressed edge for one frame', () => {
    const empty: InputState = { down: new Set(), pressed: new Set() };
    const down = applyKeyEvent(empty, 'KeyW', true);
    expect(down.down.has('KeyW')).toBe(true);
    expect(down.pressed.has('KeyW')).toBe(true);
    expect(applyKeyEvent(down, 'KeyW', true).pressed.size).toBe(1);
    const consumed = consumeEdges(down);
    expect(consumed.down.has('KeyW')).toBe(true);
    expect(consumed.pressed.has('KeyW')).toBe(false);
    expect(applyKeyEvent(consumed, 'KeyW', false).down.has('KeyW')).toBe(false);
  });

  it('only accumulates mouse movement while pointer lock is active', () => {
    const unlocked: MouseState = { x: 0, y: 0, pointerLocked: false };
    expect(applyMouseMovement(unlocked, 4, -2)).toEqual(unlocked);
    expect(applyMouseMovement({ ...unlocked, pointerLocked: true }, 4, -2)).toEqual({
      x: 4,
      y: -2,
      pointerLocked: true,
    });
  });
});
