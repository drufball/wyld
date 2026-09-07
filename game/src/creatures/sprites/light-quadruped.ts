import { canvasFor, ellipse, line, proportions } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    p = proportions(s),
    step = f === 'walk0' ? 1 : f === 'walk1' ? -1 : 0,
    l = f === 'execute' ? 2 : 0;
  if (facing === 'side') {
    ellipse(c, n / 2 + l, n - 7, 5 + p.length, 2 + p.height / 2, 1);
    line(c, n / 2 - 5, n - 8, 1, n - 12 - p.length, 2);
    ellipse(c, n / 2 + 5 + p.length / 2 + l, n - 9, 2 + p.head / 2, 2, 2);
    line(c, n / 2 + 7, n - 9, n / 2 + 9, n - 8, 3);
    for (const x of [n / 2 - 3, n / 2 + 3]) line(c, x, n - 6, x + step, n - 1, 1);
  } else {
    ellipse(c, n / 2 + l, n - 8, 3 + p.height / 2, 4 + p.length / 2, 1);
    ellipse(c, n / 2 + l, n - 12, 2 + p.head / 2, 2, 2);
    for (const x of [n / 2 - 3, n / 2 + 3])
      line(c, x, n - 6, x + (x < n / 2 ? step : -step), n - 1, 1);
    line(c, n / 2, n - 9, n / 2 + (facing === 'up' ? 3 : 0), n - 15, 2);
    if (facing === 'down') {
      c.set(n / 2 - 1 + l, n - 12, 3);
      c.set(n / 2 + 1 + l, n - 12, 3);
    }
  }
  return c;
};
export { draw };
