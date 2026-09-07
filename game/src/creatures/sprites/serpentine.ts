import { canvasFor, ellipse, variation } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, _facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    v = variation(s),
    l = f === 'execute' ? 2 : 0;
  for (let i = 0; i < 10 + v; i++) {
    const x =
      n / 2 + Math.round(Math.sin((i + (f === 'walk1' ? 2 : 0)) * 0.8) * 3) + l * (1 - i / 12);
    ellipse(c, x, n - 2 - i, 2, 2, i < 3 ? 2 : 1);
  }
  c.set(n / 2 + 3 + l, n - 11 - v, 3);
  return c;
};
export { draw };
