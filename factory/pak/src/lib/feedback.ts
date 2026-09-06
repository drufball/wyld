export type SoundKind = 'startup' | 'save' | 'rumble' | 'power-off';

const settingKey = 'wyld.sfx';
let audioContext: AudioContext | null = null;

export function isSfxOn(): boolean {
  try {
    const saved = window.localStorage?.getItem(settingKey);
    if (saved === 'on') return true;
    if (saved === 'off') return false;
  } catch {
    // Storage may be unavailable in private or restricted browsing contexts.
  }

  try {
    return !window.matchMedia?.('(pointer: coarse)').matches;
  } catch {
    return true;
  }
}

export function setSfxOn(on: boolean): void {
  try {
    window.localStorage?.setItem(settingKey, on ? 'on' : 'off');
  } catch {
    // The preference still applies as far as the available platform permits.
  }
  if (!on) resetFeedback();
}

function note(
  context: AudioContext,
  type: OscillatorType,
  frequency: number,
  start: number,
  duration: number,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

export function playSound(kind: SoundKind): void {
  if (kind === 'rumble' || !isSfxOn()) return;
  try {
    if (audioContext === null) {
      const AudioContextConstructor = window.AudioContext;
      if (AudioContextConstructor === undefined) return;
      audioContext = new AudioContextConstructor();
    }
    const context = audioContext;
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;

    if (kind === 'startup') {
      [523.25, 659.25, 783.99].forEach((frequency, index) =>
        note(context, 'triangle', frequency, now + index * 0.18, 0.22),
      );
    } else if (kind === 'save') {
      note(context, 'sine', 880, now, 0.09);
      note(context, 'sine', 1174.66, now + 0.09, 0.09);
    } else {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, now);
      oscillator.frequency.exponentialRampToValueAtTime(110, now + 0.6);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.6);
    }
  } catch {
    // Feedback must never interrupt the user's action.
  }
}

export function vibrate(pattern: number | number[]): void {
  if (!isSfxOn()) return;
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    // Some browsers expose vibration but reject individual calls.
  }
}

export function resetFeedback(): void {
  const context = audioContext;
  audioContext = null;
  if (context !== null) {
    try {
      void context.close();
    } catch {
      // Closing feedback is best-effort.
    }
  }
}
