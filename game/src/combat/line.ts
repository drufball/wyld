type Point = { x: number; y: number };

const LINE_STEP_TILES = 0.25;

const samples = (from: Point, to: Point): Point[] => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return [from];
  const count = Math.ceil(length / LINE_STEP_TILES);
  return Array.from({ length: count + 1 }, (_, index) => {
    const t = Math.min((index * LINE_STEP_TILES) / length, 1);
    return { x: from.x + dx * t, y: from.y + dy * t };
  });
};

const nearSideOf = (
  from: Point,
  to: Point,
  isWalkable: (tx: number, ty: number) => boolean,
): Point | null => {
  const fromTile = `${Math.floor(from.x)},${Math.floor(from.y)}`;
  const toTile = `${Math.floor(to.x)},${Math.floor(to.y)}`;
  let lastClear = from;
  for (const sample of samples(from, to)) {
    const tx = Math.floor(sample.x);
    const ty = Math.floor(sample.y);
    const tile = `${tx},${ty}`;
    if (tile !== fromTile && tile !== toTile && !isWalkable(tx, ty)) {
      return { x: Math.floor(lastClear.x) + 0.5, y: Math.floor(lastClear.y) + 0.5 };
    }
    lastClear = sample;
  }
  return null;
};

const lineClear = (
  from: Point,
  to: Point,
  isWalkable: (tx: number, ty: number) => boolean,
): boolean => nearSideOf(from, to, isWalkable) === null;

export { LINE_STEP_TILES, lineClear, nearSideOf };
export type { Point };
