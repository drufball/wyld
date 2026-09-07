import { describe, expect, it } from 'vitest';

import { createCallAudio } from './calls.js';

describe('createCallAudio', () => {
  it('silently ignores play before the first user gesture', () => {
    const audio = createCallAudio();
    expect(audio.ready()).toBe(false);
    expect(() => audio.play({ waveform: 'sine', notes: [{ freq: 440, dur: 0.1 }] })).not.toThrow();
  });
});
