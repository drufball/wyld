import { describe, expect, it } from 'vitest';

import { applyKeyEvent, consumeEdges } from './input.js';
import type { InputState } from './input.js';

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
});
