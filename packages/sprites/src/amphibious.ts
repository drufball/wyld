import { canvasFor, ellipse, line, proportions } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    p = proportions(s),
    step = f === 'walk0' ? 1 : f === 'walk1' ? -1 : 0,
    l = f === 'execute' ? 2 : 0;
  ellipse(c, n / 2 + l, n - 6, facing === 'side' ? 6 + p.length : 4 + p.height, 3, 1);
  ellipse(c, n / 2 + (facing === 'side' ? 5 : 0) + l, n - 9, 2 + p.head, 2, 2);
  line(c, n / 2 - 3, n - 4, 1, n - 1 + Math.min(0, step), 2);
  line(c, n / 2 + 3, n - 4, n - 2, n - 1 - Math.max(0, step), 2);
  if (facing === 'down') {
    c.set(n / 2 - 1 + l, n - 10, 3);
    c.set(n / 2 + 1 + l, n - 10, 3);
  } else if (facing === 'up') line(c, n / 2 - 3, n - 9, n / 2 + 3, n - 9, 1);
  else line(c, n / 2 - 5, n - 6, 1, n - 7, 2);
  return c;
};
export { draw };
