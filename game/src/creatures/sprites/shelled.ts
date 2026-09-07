import { canvasFor, ellipse, rect, variation } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, _facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    v = variation(s),
    step = f === 'walk0' ? 1 : f === 'walk1' ? -1 : 0,
    l = f === 'execute' ? 2 : 0;
  ellipse(c, n / 2, n - 6, 6 + v, 5, 1);
  ellipse(c, n / 2, n - 7, 4 + v, 3, 2);
  rect(c, n / 2 + 5 + l, n - 6, 3, 3, 3);
  rect(c, n / 2 - 5, n - 2 + step, 2, 2, 2);
  rect(c, n / 2 + 3, n - 2 - step, 2, 2, 2);
  return c;
};
export { draw };
