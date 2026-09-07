type Point = { tx: number; ty: number };
type PathGrid = { isWalkable(tx: number, ty: number): boolean };
const findPath = (grid: PathGrid, from: Point, to: Point): readonly Point[] | null => {
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
      const fa = ga + Math.abs(a.tx - to.tx) + Math.abs(a.ty - to.ty),
        fb = gb + Math.abs(b.tx - to.tx) + Math.abs(b.ty - to.ty);
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
    for (const [dx, dy] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
    ] as const) {
      const n = { tx: current.tx + dx, ty: current.ty + dy },
        nk = key(n);
      if (!grid.isWalkable(n.tx, n.ty) || closed.has(nk)) continue;
      const ng = g.get(ck)! + 1;
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
export type { PathGrid, Point };
