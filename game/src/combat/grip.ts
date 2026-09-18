import type { Delivery } from './moves.js';

const GRIP_MAX_PIPS = 3;
const GRIP_PIP_SECONDS = 0.5;
const GRIP_WINDOW_SECONDS = 2;
const GRIP_HOLD_SECONDS = 1.5;
const GRIP_IMMUNE_SECONDS = 1;
const GRIP_SLOW_FACTOR = 0.75;

type Grip = {
  pips: number;
  firstPipAt: number;
  pipsUntil: number;
  heldUntil: number;
  immuneUntil: number;
};
type PublicGrip = { pips: number; held: boolean; immune: boolean };

const emptyGrip = (): Grip => ({
  pips: 0,
  firstPipAt: 0,
  pipsUntil: 0,
  heldUntil: 0,
  immuneUntil: 0,
});

const applyGrip = (grip: Grip, now: number): { grip: Grip; held: boolean; slowed: boolean } => {
  if (now < grip.immuneUntil) return { grip, held: false, slowed: false };
  const lapsed = grip.pips === 0 || now > grip.pipsUntil;
  const next: Grip = {
    ...grip,
    pips: lapsed ? 1 : Math.min(GRIP_MAX_PIPS, grip.pips + 1),
    firstPipAt: lapsed ? now : grip.firstPipAt,
    pipsUntil: now + GRIP_PIP_SECONDS,
  };
  if (next.pips === GRIP_MAX_PIPS && now - next.firstPipAt <= GRIP_WINDOW_SECONDS) {
    next.heldUntil = now + GRIP_HOLD_SECONDS;
    next.immuneUntil = next.heldUntil + GRIP_IMMUNE_SECONDS;
    next.pips = 0;
    next.pipsUntil = 0;
    return { grip: next, held: true, slowed: true };
  }
  return { grip: next, held: false, slowed: true };
};

const gripSpeedScale = (grip: Grip, now: number): number =>
  now < grip.heldUntil ? 0 : grip.pips > 0 && now < grip.pipsUntil ? GRIP_SLOW_FACTOR : 1;

const publicGrip = (grip: Grip, now: number): PublicGrip => ({
  pips: now > grip.pipsUntil ? 0 : grip.pips,
  held: now < grip.heldUntil,
  immune: now < grip.immuneUntil,
});

// Thrown Bolt and Arc moves do not make contact; a Lunge is the charge a hold stops.
const gripsFrom = (delivery: Delivery): boolean => delivery === 'Strike' || delivery === 'Sweep';
const gripScaleFromPublic = (grip: Pick<PublicGrip, 'pips' | 'held'>): number =>
  grip.held ? 0 : grip.pips > 0 ? GRIP_SLOW_FACTOR : 1;

export {
  GRIP_HOLD_SECONDS,
  GRIP_IMMUNE_SECONDS,
  GRIP_MAX_PIPS,
  GRIP_PIP_SECONDS,
  GRIP_SLOW_FACTOR,
  GRIP_WINDOW_SECONDS,
  applyGrip,
  emptyGrip,
  gripScaleFromPublic,
  gripSpeedScale,
  gripsFrom,
  publicGrip,
};
export type { Grip, PublicGrip };
