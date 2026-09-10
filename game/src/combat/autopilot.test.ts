import { describe, expect, it } from 'vitest';
import { createAutopilot, DOUBLE_TAP_SECONDS } from './autopilot.js';

describe('combat autopilot', () => {
  it('arms a move on a single tap', () => {
    const autopilot = createAutopilot();
    autopilot.tap('one', 'strike', 1);
    expect(autopilot.armed('one')).toBe('strike');
  });

  it('disarms the armed move when it is tapped again', () => {
    const autopilot = createAutopilot();
    autopilot.tap('one', 'strike', 1);
    autopilot.tap('one', 'strike', 1 + DOUBLE_TAP_SECONDS + 0.01);
    expect(autopilot.armed('one')).toBeNull();
  });

  it('replaces the armed move when another is tapped', () => {
    const autopilot = createAutopilot();
    autopilot.tap('one', 'strike', 1);
    autopilot.tap('one', 'bolt', 1.1);
    expect(autopilot.armed('one')).toBe('bolt');
  });

  it('leaves the autopilot untouched after two taps within the double tap window', () => {
    const autopilot = createAutopilot();
    autopilot.tap('one', 'strike', 0);
    autopilot.tap('one', 'bolt', 1);
    autopilot.tap('one', 'bolt', 1.2);
    expect(autopilot.armed('one')).toBe('strike');
  });

  it('treats two taps more than the double tap window apart as two taps', () => {
    const autopilot = createAutopilot();
    autopilot.tap('one', 'strike', 0);
    autopilot.tap('one', 'strike', DOUBLE_TAP_SECONDS + 0.01);
    expect(autopilot.armed('one')).toBeNull();
  });

  it('keeps a separate armed move for each creature', () => {
    const autopilot = createAutopilot();
    autopilot.tap('one', 'strike', 0);
    autopilot.tap('two', 'bolt', 0);
    expect(autopilot.list()).toEqual([
      { creatureId: 'one', moveId: 'strike' },
      { creatureId: 'two', moveId: 'bolt' },
    ]);
  });

  it('clears one creature without disturbing the others', () => {
    const autopilot = createAutopilot();
    autopilot.tap('one', 'strike', 0);
    autopilot.tap('two', 'bolt', 0);
    autopilot.clear('one');
    expect(autopilot.list()).toEqual([{ creatureId: 'two', moveId: 'bolt' }]);
  });

  it('clears every creature at the end of a fight', () => {
    const autopilot = createAutopilot();
    autopilot.tap('one', 'strike', 0);
    autopilot.tap('two', 'bolt', 0);
    autopilot.clearAll();
    expect(autopilot.list()).toEqual([]);
  });
});
