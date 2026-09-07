import { canvasFor, ellipse, line, rect, variation } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, _facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    v = variation(s),
    step = f === 'walk0' ? 1 : f === 'walk1' ? -1 : 0,
    l = f === 'execute' ? 2 : 0;
  ellipse(c, n / 2 + l, n - 7, 4 + v, 3, 1);
  rect(c, n / 2 + 3 + l, n - 10, 3, 4, 2);
  line(c, n / 2 - 3, n - 7, 2, n - 10 - v, 2);
  line(c, n / 2 - 2, n - 5, 3, n - 1 + step, 1);
  line(c, n / 2 + 2, n - 5, n - 2, n - 1 - step, 1);
  return c;
};
export { draw };
