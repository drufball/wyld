import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCallAudio } from './calls.js';

const originalAudioContext = globalThis.AudioContext;

class FakeParam {
  readonly setValueAtTime = vi.fn();
  readonly linearRampToValueAtTime = vi.fn();
}

class FakeNode extends EventTarget {
  readonly connect = vi.fn(() => this);
  readonly disconnect = vi.fn();
}

class FakeOscillator extends FakeNode {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeParam();
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

class FakeBufferSource extends FakeNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  readonly start = vi.fn();
  readonly stop = vi.fn();
}

class FakeAudioContext {
  static latest: FakeAudioContext;
  readonly currentTime = 5;
  readonly sampleRate = 4;
  readonly destination = new FakeNode();
  readonly oscillators: FakeOscillator[] = [];
  readonly gains: FakeGain[] = [];
  readonly bufferSources: FakeBufferSource[] = [];
  readonly resume = vi.fn();
  readonly close = vi.fn();

  constructor() {
    FakeAudioContext.latest = this;
  }

  createOscillator = () => {
    const node = new FakeOscillator();
    this.oscillators.push(node);
    return node;
  };

  createGain = () => {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  };

  createBufferSource = () => {
    const node = new FakeBufferSource();
    this.bufferSources.push(node);
    return node;
  };

  createBuffer = () => ({ getChannelData: () => new Float32Array(this.sampleRate) });
}

const unlock = () => {
  globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
  const audio = createCallAudio();
  const target = new EventTarget();
  audio.resumeOnGesture(target);
  target.dispatchEvent(new Event('pointerdown'));
  return { audio, context: FakeAudioContext.latest };
};

afterEach(() => {
  globalThis.AudioContext = originalAudioContext;
});

describe('createCallAudio', () => {
  it('silently ignores play before the first user gesture', () => {
    const audio = createCallAudio();
    expect(audio.ready()).toBe(false);
    expect(() => audio.play({ waveform: 'sine', notes: [{ freq: 440, dur: 0.1 }] })).not.toThrow();
  });

  it('plays one correctly sequenced oscillator per note and clamps gain', () => {
    const { audio, context } = unlock();
    audio.play(
      {
        waveform: 'triangle',
        notes: [
          { freq: 220, dur: 0.2 },
          { freq: 330, dur: 0.3 },
        ],
      },
      4,
    );
    expect(context.oscillators).toHaveLength(2);
    expect(context.oscillators.map(({ type }) => type)).toEqual(['triangle', 'triangle']);
    expect(context.oscillators[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(220, 5);
    expect(context.oscillators[1]!.frequency.setValueAtTime).toHaveBeenCalledWith(330, 5.2);
    expect(context.oscillators[0]!.start).toHaveBeenCalledWith(5);
    expect(context.oscillators[1]!.start).toHaveBeenCalledWith(5.2);
    expect(context.gains[0]!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 5.015);
    expect(context.bufferSources).toHaveLength(0);
  });

  it('creates noise only when requested and envelopes its clamped gain', () => {
    const { audio, context } = unlock();
    audio.play({ waveform: 'sine', notes: [{ freq: 110, dur: 0.1 }], noise: 0.5 }, -2);
    expect(context.bufferSources).toHaveLength(1);
    const noiseEnvelope = context.gains[1]!;
    expect(noiseEnvelope.gain.setValueAtTime).toHaveBeenNthCalledWith(1, 0, 5);
    expect(noiseEnvelope.gain.linearRampToValueAtTime).toHaveBeenNthCalledWith(1, 0, 5.015);
    expect(noiseEnvelope.gain.linearRampToValueAtTime).toHaveBeenNthCalledWith(2, 0, 5.1);
  });
});
