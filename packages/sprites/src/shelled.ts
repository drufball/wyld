import { canvasFor, ellipse, line, rect, proportions } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    p = proportions(s),
    step = f === 'walk0' ? 1 : f === 'walk1' ? -1 : 0,
    l = f === 'execute' ? 2 : 0;
  ellipse(c, n / 2, n - 6, facing === 'side' ? 6 + p.length : 5 + p.height, 5, 1);
  ellipse(c, n / 2, n - 7, facing === 'up' ? 5 + p.length : 4 + p.length, 3 + p.height / 2, 2);
  if (facing !== 'up') rect(c, n / 2 + (facing === 'side' ? 6 : 0) + l, n - 7, 3 + p.head, 3, 3);
  else {
    line(c, n / 2, n - 10, n / 2, n - 5, 1);
    line(c, n / 2 - 3, n - 7, n / 2 + 3, n - 7, 1);
  }
  rect(c, n / 2 - 5, n - 2 + step, 2, 2, 2);
  rect(c, n / 2 + 3, n - 2 - step, 2, 2, 2);
  return c;
};
export { draw };
