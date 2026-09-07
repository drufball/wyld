import { canvasFor, ellipse, line, rect, variation } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, _facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    v = variation(s),
    step = f === 'walk0' ? 2 : f === 'walk1' ? -2 : 0,
    l = f === 'execute' ? 2 : 0;
  ellipse(c, n / 2 + l, n - 19 - v, 5, 6, 1);
  ellipse(c, n / 2 + l, n - 27 - v, 4, 4, 2);
  rect(c, n / 2 - 4 + l, n - 17, 3, 12 + step, 1);
  rect(c, n / 2 + 2 + l, n - 17, 3, 12 - step, 1);
  line(c, n / 2 - 4, n - 18, n / 2 - 8, n - 10 + (f === 'execute' ? -4 : 0), 2);
  line(c, n / 2 + 4, n - 18, n / 2 + 8 + l, n - 10, 2);
  return c;
};
export { draw };
