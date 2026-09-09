import type { Rng } from '../engine/rng.js';
import { yawFromDelta } from './facing.js';

type Point = { x: number; z: number };
type WanderState = {
  target: Point | null;
  pauseUntil: number;
  repickAt: number;
  homeX: number;
  homeZ: number;
  radius: number;
  facing: number;
};
type WanderOptions = {
  speedStat: number;
  canSwim: boolean;
  depthAt(x: number, z: number): number;
  slopeAt(x: number, z: number): number;
  walkableAt?(x: number, z: number, canSwim: boolean): boolean;
};

const createWander = (rng: Rng) => {
  const begin = (
    homeX: number,
    homeZ: number,
    radius: number,
    now: number,
    facing = 0,
  ): WanderState => ({
    target: null,
    pauseUntil: now,
    repickAt: now + rng.range(4, 8),
    homeX,
    homeZ,
    radius,
    facing,
  });
  const step = (
    state: WanderState,
    position: Point,
    now: number,
    dt: number,
    options: WanderOptions,
  ): Point & { moving: boolean; facing: number } => {
    if (!state.target && now >= state.pauseUntil && now >= state.repickAt) {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const angle = rng.range(0, Math.PI * 2);
        const distance = rng.range(5, 15);
        const target = {
          x: position.x + Math.sin(angle) * distance,
          z: position.z + Math.cos(angle) * distance,
        };
        if (Math.hypot(target.x - state.homeX, target.z - state.homeZ) > state.radius) continue;
        if (options.walkableAt) {
          if (!options.walkableAt(target.x, target.z, options.canSwim)) continue;
        } else {
          if (options.slopeAt(target.x, target.z) >= 30) continue;
          if (!options.canSwim && options.depthAt(target.x, target.z) > 0) continue;
        }
        state.target = target;
        break;
      }
      state.repickAt = now + rng.range(4, 8);
      if (!state.target) state.pauseUntil = now + rng.range(2, 5);
    }
    if (!state.target) return { ...position, moving: false, facing: state.facing };
    const dx = state.target.x - position.x;
    const dz = state.target.z - position.z;
    const distance = Math.hypot(dx, dz);
    const facing = yawFromDelta(dx, dz);
    state.facing = facing;
    // Wandering is an amble at 35% of the full §5.2 movement speed.
    const travel = Math.min(distance, (3 + options.speedStat * 0.6) * 0.35 * dt);
    if (travel >= distance) {
      const result = { ...state.target, moving: false, facing };
      state.target = null;
      state.pauseUntil = now + rng.range(2, 5);
      state.repickAt = now + rng.range(4, 8);
      return result;
    }
    return {
      x: position.x + (dx / distance) * travel,
      z: position.z + (dz / distance) * travel,
      moving: true,
      facing,
    };
  };
  return { begin, step };
};

export { createWander };
export type { WanderOptions, WanderState };
