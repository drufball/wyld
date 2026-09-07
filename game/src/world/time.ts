const PHASE_SECONDS = 180;
const DAY_SECONDS = PHASE_SECONDS * 4;

const phases = ['Dawn', 'Day', 'Dusk', 'Night'] as const;
type Phase = (typeof phases)[number];
type TimeState = { phase: Phase; phaseProgress: number; day: number; dayProgress: number };

const timeAt = (elapsedSeconds: number): TimeState => {
  const elapsed = Math.max(0, elapsedSeconds);
  const dayIndex = Math.floor(elapsed / DAY_SECONDS);
  const withinDay = elapsed - dayIndex * DAY_SECONDS;
  const phaseIndex = Math.min(3, Math.floor(withinDay / PHASE_SECONDS));
  return {
    phase: phases[phaseIndex] ?? 'Dawn',
    phaseProgress: (withinDay - phaseIndex * PHASE_SECONDS) / PHASE_SECONDS,
    day: dayIndex + 1,
    dayProgress: withinDay / DAY_SECONDS,
  };
};

const nextPhaseStart = (elapsedSeconds: number, target: Phase): number => {
  const elapsed = Math.max(0, elapsedSeconds);
  const offset = phases.indexOf(target) * PHASE_SECONDS;
  const dayStart = Math.floor(elapsed / DAY_SECONDS) * DAY_SECONDS;
  const candidate = dayStart + offset;
  return candidate > elapsed ? candidate : candidate + DAY_SECONDS;
};

const phaseBoundariesBetween = (fromSeconds: number, toSeconds: number): TimeState[] => {
  const boundaries: TimeState[] = [];
  if (toSeconds <= fromSeconds) return boundaries;
  let boundary = (Math.floor(fromSeconds / PHASE_SECONDS) + 1) * PHASE_SECONDS;
  while (boundary <= toSeconds) {
    boundaries.push(timeAt(boundary));
    boundary += PHASE_SECONDS;
  }
  return boundaries;
};

export { DAY_SECONDS, PHASE_SECONDS, nextPhaseStart, phaseBoundariesBetween, phases, timeAt };
export type { Phase, TimeState };
