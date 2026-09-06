import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSfxOn, playSound, resetFeedback, setSfxOn, vibrate } from './feedback.js';

function audioFakes() {
  const parameter = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  const oscillator = {
    type: 'sine',
    frequency: parameter,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = { gain: parameter, connect: vi.fn() };
  const close = vi.fn();
  const Context = vi.fn(
    class {
      currentTime = 1;
      destination = {};
      state = 'running';
      resume = vi.fn();
      close = close;
      createOscillator = vi.fn(() => oscillator);
      createGain = vi.fn(() => gain);
    },
  );
  return { Context, close };
}

afterEach(() => {
  resetFeedback();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('feedback settings', () => {
  it('defaults according to the pointer and honors a saved value', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    expect(isSfxOn()).toBe(false);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    expect(isSfxOn()).toBe(true);
    localStorage.setItem('wyld.sfx', 'off');
    expect(isSfxOn()).toBe(false);
  });

  it('is safe without AudioContext and while disabled', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playSound('save')).not.toThrow();
    setSfxOn(false);
    expect(() => playSound('save')).not.toThrow();
  });
});

describe('audio', () => {
  it('lazily reuses one context and gives rumble no audio', () => {
    const { Context } = audioFakes();
    vi.stubGlobal('AudioContext', Context);
    playSound('rumble');
    expect(Context).not.toHaveBeenCalled();
    playSound('save');
    playSound('save');
    expect(Context).toHaveBeenCalledTimes(1);
  });

  it('closes and rebuilds the context when reset', () => {
    const { Context, close } = audioFakes();
    vi.stubGlobal('AudioContext', Context);
    playSound('save');
    resetFeedback();
    expect(close).toHaveBeenCalledOnce();
    playSound('save');
    expect(Context).toHaveBeenCalledTimes(2);
  });
});

describe('haptics', () => {
  it('forwards supported vibration and ignores missing or disabled vibration', () => {
    vi.stubGlobal('navigator', {});
    expect(() => vibrate(20)).not.toThrow();
    const vibration = vi.fn();
    vi.stubGlobal('navigator', { vibrate: vibration });
    vibrate([30, 40, 60]);
    expect(vibration).toHaveBeenCalledWith([30, 40, 60]);
    setSfxOn(false);
    vibrate(20);
    expect(vibration).toHaveBeenCalledTimes(1);
  });
});
