import type { CombatEvent } from './encounter.js';

const LUNGE_SECONDS = 0.25;
const LUNGE_PEAK_TILES = 0.45;
const LUNGE_OUT_FRACTION = 0.4;

type Point = { x: number; y: number };
type Lunge = {
  attacker: string;
  targetId: string;
  moveId: string;
  direction: Point;
  elapsed: number;
};

// 0 at the start, 1 at the peak, 0 at the end.
const lungeCurve = (progress: number): number => {
  if (progress <= 0 || progress >= 1) return 0;
  if (progress <= LUNGE_OUT_FRACTION) return progress / LUNGE_OUT_FRACTION;
  return (1 - progress) / (1 - LUNGE_OUT_FRACTION);
};

const createAnimations = () => {
  const lunges = new Map<string, Lunge>();
  let started = 0;
  return {
    push(events: readonly CombatEvent[], tileOf: (id: string) => Point | undefined): void {
      for (const event of events) {
        if (event.type !== 'executed' || !event.attacker || !event.target || !event.move) continue;
        const attackerTile = tileOf(event.attacker);
        const targetTile = tileOf(event.target);
        const dx = targetTile && attackerTile ? targetTile.x - attackerTile.x : 0;
        const dy = targetTile && attackerTile ? targetTile.y - attackerTile.y : 0;
        const distance = Math.hypot(dx, dy);
        lunges.set(event.attacker, {
          attacker: event.attacker,
          targetId: event.target,
          moveId: event.move,
          direction: distance === 0 ? { x: 0, y: 0 } : { x: dx / distance, y: dy / distance },
          elapsed: 0,
        });
        started += 1;
      }
    },
    update(dt: number): void {
      for (const [id, lunge] of lunges) {
        lunge.elapsed += dt;
        if (lunge.elapsed > LUNGE_SECONDS) lunges.delete(id);
      }
    },
    offsetFor(id: string): Point {
      const lunge = lunges.get(id);
      if (!lunge) return { x: 0, y: 0 };
      const distance = LUNGE_PEAK_TILES * lungeCurve(lunge.elapsed / LUNGE_SECONDS);
      return { x: lunge.direction.x * distance, y: lunge.direction.y * distance };
    },
    lunging: (id: string): boolean => lunges.has(id),
    list: (): readonly Lunge[] => [...lunges.values()],
    startedCount: (): number => started,
    clear(): void {
      lunges.clear();
    },
  };
};

export { LUNGE_OUT_FRACTION, LUNGE_PEAK_TILES, LUNGE_SECONDS, createAnimations };
export type { Lunge, Point };
