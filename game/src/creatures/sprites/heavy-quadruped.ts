import { canvasFor, ellipse, rect, variation } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, _facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    v = variation(s),
    step = f === 'walk0' ? 1 : f === 'walk1' ? -1 : 0,
    l = f === 'execute' ? 2 : 0;
  ellipse(c, n / 2 + l, n - 6, 6 + v, 4, 1);
  rect(c, n / 2 + 3 + l, n - 10, 5, 5, 2);
  rect(c, n / 2 - 5, n - 4 + step, 2, 4, 2);
  rect(c, n / 2 + 3, n - 4 - step, 2, 4, 2);
  return c;
};
export { draw };
