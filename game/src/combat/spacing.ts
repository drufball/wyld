const MIN_SEPARATION_TILES = 1;
type Body = { id: string; tile: { x: number; y: number }; maxStep: number };
type Point = { x: number; y: number };

const separate = (
  bodies: readonly Body[],
  isWalkable: (tx: number, ty: number) => boolean,
  minSeparation = MIN_SEPARATION_TILES,
): Record<string, Point> => {
  const displacement = bodies.map(() => ({ x: 0, y: 0 }));
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const earlier = bodies[i]!,
        later = bodies[j]!,
        dx = later.tile.x - earlier.tile.x,
        dy = later.tile.y - earlier.tile.y,
        distance = Math.hypot(dx, dy);
      if (distance >= minSeparation) continue;
      const overlapHalf = (minSeparation - distance) / 2,
        ux = distance === 0 ? 1 : dx / distance,
        uy = distance === 0 ? 0 : dy / distance;
      displacement[i]!.x -= ux * overlapHalf;
      displacement[i]!.y -= uy * overlapHalf;
      displacement[j]!.x += ux * overlapHalf;
      displacement[j]!.y += uy * overlapHalf;
    }
  }

  return Object.fromEntries(
    bodies.map((body, index) => {
      const requested = displacement[index]!,
        length = Math.hypot(requested.x, requested.y),
        scale = length > body.maxStep ? body.maxStep / length : 1,
        candidate = {
          x: body.tile.x + requested.x * scale,
          y: body.tile.y + requested.y * scale,
        };
      return [
        body.id,
        isWalkable(Math.floor(candidate.x), Math.floor(candidate.y)) ? candidate : { ...body.tile },
      ];
    }),
  );
};

export { MIN_SEPARATION_TILES, separate };
export type { Body };
