type Point = { tx: number; ty: number };
type PathGrid = { isWalkable(tx: number, ty: number): boolean };
type PathBounds = { minTx: number; maxTx: number; minTy: number; maxTy: number; across?: Point };
type PathOptions = PathBounds & { diagonals?: boolean };
const findPath = (
  grid: PathGrid,
  from: Point,
  to: Point,
  bounds?: PathOptions,
): readonly Point[] | null => {
  if (!grid.isWalkable(to.tx, to.ty)) return null;
  const key = (p: Point) => `${p.tx},${p.ty}`;
  const start = { tx: Math.floor(from.tx), ty: Math.floor(from.ty) };
  const open = [start],
    came = new Map<string, Point>(),
    g = new Map([[key(start), 0]]),
    closed = new Set<string>();
  let expanded = 0;
  while (open.length && expanded < 4000) {
    open.sort((a, b) => {
      const ga = g.get(key(a))!,
        gb = g.get(key(b))!;
      const heuristic = (p: Point) =>
          bounds?.diagonals
            ? Math.hypot(p.tx - to.tx, p.ty - to.ty)
            : Math.abs(p.tx - to.tx) + Math.abs(p.ty - to.ty),
        fa = ga + heuristic(a),
        fb = gb + heuristic(b);
      return fa - fb || a.ty - b.ty || a.tx - b.tx;
    });
    const current = open.shift()!;
    const ck = key(current);
    if (closed.has(ck)) continue;
    closed.add(ck);
    expanded++;
    if (current.tx === to.tx && current.ty === to.ty) {
      const path: Point[] = [];
      let p = current;
      while (key(p) !== key(start)) {
        path.unshift(p);
        p = came.get(key(p))!;
      }
      return path;
    }
    const steps = [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
      ...(bounds?.diagonals
        ? ([
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ] as const)
        : []),
    ] as const;
    for (const [dx, dy] of steps) {
      const n = { tx: current.tx + dx, ty: current.ty + dy },
        nk = key(n);
      const inBounds =
        !bounds ||
        (n.tx >= bounds.minTx &&
          n.tx <= bounds.maxTx &&
          n.ty >= bounds.minTy &&
          n.ty <= bounds.maxTy) ||
        (n.tx === bounds.across?.tx && n.ty === bounds.across.ty);
      const diagonal = dx !== 0 && dy !== 0;
      if (
        !inBounds ||
        !grid.isWalkable(n.tx, n.ty) ||
        closed.has(nk) ||
        (diagonal &&
          (!grid.isWalkable(current.tx + dx, current.ty) ||
            !grid.isWalkable(current.tx, current.ty + dy)))
      )
        continue;
      const ng = g.get(ck)! + (diagonal ? Math.SQRT2 : 1);
      if (ng < (g.get(nk) ?? Infinity)) {
        came.set(nk, current);
        g.set(nk, ng);
        if (!open.some((p) => key(p) === nk)) open.push(n);
      }
    }
  }
  return null;
};
export { findPath };
export type { PathBounds, PathGrid, PathOptions, Point };
