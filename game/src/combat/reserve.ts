import { MIN_SEPARATION_TILES } from './spacing.js';

const RESERVE_AUTO_DEPLOY_SECONDS = 2;
const ENTRY_GRACE_SECONDS = 1;
type Point = { x: number; y: number };
type SwapTapOutcome = { outId: string } | { reason: string };

const reserveEntryNotice = (input: {
  party: readonly { id: string; downed: boolean; benched: boolean }[];
  reserveIds: readonly string[];
  nameOf: (id: string) => string | null;
}): string | null => {
  const fallen = input.party.find(({ benched }) => !benched);
  const reserveId = input.reserveIds[0];
  if (!fallen || !reserveId) return null;
  const fallenName = input.nameOf(fallen.id);
  const reserveName = input.nameOf(reserveId);
  if (!fallenName || !reserveName) return null;
  return `${fallenName} is down — ${reserveName} is coming in.`;
};

const reserveEntryLine = (input: Parameters<typeof reserveEntryNotice>[0]): string =>
  reserveEntryNotice(input) ?? 'Down';

const centre = (point: Point): Point => ({
  x: Math.floor(point.x) + 0.5,
  y: Math.floor(point.y) + 0.5,
});
const entryTile = (input: {
  fallen: Point;
  enemy: Point;
  isWalkable(tx: number, ty: number): boolean;
  occupied: readonly Point[];
  minSeparation?: number;
}): Point => {
  const dx = input.fallen.x - input.enemy.x,
    dy = input.fallen.y - input.enemy.y,
    length = Math.hypot(dx, dy),
    u = length === 0 ? { x: 0, y: 1 } : { x: dx / length, y: dy / length },
    first = centre({ x: input.fallen.x + u.x, y: input.fallen.y + u.y }),
    directions = [
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
    ],
    around = directions
      .map((d, order) => ({ point: centre({ x: first.x + d.x, y: first.y + d.y }), order }))
      .sort(
        (a, b) =>
          Math.hypot(b.point.x - input.enemy.x, b.point.y - input.enemy.y) -
            Math.hypot(a.point.x - input.enemy.x, a.point.y - input.enemy.y) || a.order - b.order,
      )
      .map(({ point }) => point),
    candidates = [
      first,
      centre({ x: input.fallen.x + 2 * u.x, y: input.fallen.y + 2 * u.y }),
      ...around,
      centre(input.fallen),
    ],
    separation = input.minSeparation ?? MIN_SEPARATION_TILES;
  return (
    candidates.find(
      (candidate) =>
        input.isWalkable(Math.floor(candidate.x), Math.floor(candidate.y)) &&
        input.occupied.every((p) => Math.hypot(candidate.x - p.x, candidate.y - p.y) >= separation),
    ) ?? centre(input.fallen)
  );
};

const swapTapOutcome = (input: {
  phase: 'fight' | 'win' | 'driven-off';
  party: readonly { id: string; downed: boolean; benched: boolean }[];
  swapCooldownRemaining: number;
}): SwapTapOutcome => {
  if (input.phase !== 'fight') return { reason: 'The fight is over' };
  if (!input.party.some((c) => c.benched && !c.downed)) return { reason: 'Nobody in reserve' };
  const outgoing = input.party.find((c) => !c.benched);
  if (!outgoing) return { reason: 'The fight is over' };
  if (!outgoing.downed && input.swapCooldownRemaining > 0)
    return { reason: `Swap ready in ${Math.ceil(input.swapCooldownRemaining)} s` };
  return { outId: outgoing.id };
};

export {
  ENTRY_GRACE_SECONDS,
  RESERVE_AUTO_DEPLOY_SECONDS,
  entryTile,
  reserveEntryLine,
  reserveEntryNotice,
  swapTapOutcome,
};
export type { Point, SwapTapOutcome };
