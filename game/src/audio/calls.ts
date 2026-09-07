import type { CallDescriptor } from '../creatures/species.js';

const createCallAudio = () => {
  let context: AudioContext | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  const ensureContext = (): void => {
    if (!context) context = new AudioContext();
    void context.resume();
  };
  const resumeOnGesture = (target: EventTarget): (() => void) => {
    const gesture = (): void => {
      ensureContext();
      unsubscribe();
    };
    const unsubscribe = (): void => {
      target.removeEventListener('pointerdown', gesture);
      target.removeEventListener('keydown', gesture);
    };
    target.addEventListener('pointerdown', gesture, { once: true });
    target.addEventListener('keydown', gesture, { once: true });
    return unsubscribe;
  };
  const play = (call: CallDescriptor, requestedGain = 1): void => {
    if (!context) return;
    const gain = Math.max(0, Math.min(1, requestedGain));
    let offset = 0;
    for (const note of call.notes) {
      const start = context.currentTime + offset;
      const end = start + note.dur;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = call.waveform;
      oscillator.frequency.setValueAtTime(note.freq, start);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(gain, Math.min(end, start + 0.015));
      envelope.gain.setValueAtTime(gain, Math.max(start, end - 0.015));
      envelope.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(envelope).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end);
      oscillator.addEventListener(
        'ended',
        () => {
          oscillator.disconnect();
          envelope.disconnect();
        },
        { once: true },
      );
      if ((call.noise ?? 0) > 0) {
        if (!noiseBuffer) {
          noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
          const channel = noiseBuffer.getChannelData(0);
          // A fixed hash provides reusable white-ish noise without gameplay randomness.
          for (let index = 0; index < channel.length; index += 1)
            channel[index] = (((Math.imul(index, 1103515245) + 12345) >>> 8) / 0x01000000) * 2 - 1;
        }
        const source = context.createBufferSource();
        const noiseGain = context.createGain();
        source.buffer = noiseBuffer;
        source.loop = true;
        const noiseLevel = gain * (call.noise ?? 0);
        noiseGain.gain.setValueAtTime(0, start);
        noiseGain.gain.linearRampToValueAtTime(noiseLevel, Math.min(end, start + 0.015));
        noiseGain.gain.setValueAtTime(noiseLevel, Math.max(start, end - 0.015));
        noiseGain.gain.linearRampToValueAtTime(0, end);
        source.connect(noiseGain).connect(context.destination);
        source.start(start);
        source.stop(end);
        source.addEventListener(
          'ended',
          () => {
            source.disconnect();
            noiseGain.disconnect();
          },
          { once: true },
        );
      }
      offset += note.dur;
    }
  };
  const dispose = (): void => {
    const active = context;
    context = null;
    noiseBuffer = null;
    if (active) void active.close();
  };
  return { ready: () => context !== null, resumeOnGesture, play, dispose };
};

export { createCallAudio };
