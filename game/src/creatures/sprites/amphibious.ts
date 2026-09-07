import { canvasFor, ellipse, line, variation } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, _facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    v = variation(s),
    step = f === 'walk0' ? 1 : f === 'walk1' ? -1 : 0,
    l = f === 'execute' ? 2 : 0;
  ellipse(c, n / 2 + l, n - 5, 5 + v, 3, 1);
  ellipse(c, n / 2 + l, n - 8, 4, 2, 2);
  line(c, n / 2 - 3, n - 4, 2, n - 1 + step, 2);
  line(c, n / 2 + 3, n - 4, n - 3, n - 1 - step, 2);
  return c;
};
export { draw };
