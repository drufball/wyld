import { canvasFor, ellipse, line, rect, proportions } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    p = proportions(s),
    step = f === 'walk0' ? 1 : f === 'walk1' ? -1 : 0,
    l = f === 'execute' ? 2 : 0;
  if (facing === 'side') {
    ellipse(c, n / 2 - 1 + l, n - 7, 6 + p.length, 3 + p.height / 2, 1);
    ellipse(c, n / 2 + 6 + p.length / 2 + l, n - 9, 2 + p.head, 2 + p.head / 2, 2);
    rect(c, n / 2 - 6, n - 5 + step, 3, 6 - step, 2);
    rect(c, n / 2 + 2, n - 5 - step, 3, 6 + step, 2);
    line(c, n / 2 + 7, n - 11, n / 2 + 8 + p.head, n - 14, 3);
  } else {
    ellipse(c, n / 2 + l, n - 8, 5 + p.length / 2, 4 + p.height / 2, 1);
    ellipse(c, n / 2 + l, n - 12, 3 + p.head, 2 + p.head / 2, 2);
    for (const x of [n / 2 - 4, n / 2 + 2]) rect(c, x, n - 5 + (x < n / 2 ? step : -step), 3, 5, 2);
    if (facing === 'down') {
      c.set(n / 2 - 2 + l, n - 12, 3);
      c.set(n / 2 + 2 + l, n - 12, 3);
      line(c, n / 2 - 3, n - 14, n / 2 - 5, n - 16, 3);
      line(c, n / 2 + 3, n - 14, n / 2 + 5, n - 16, 3);
    } else line(c, n / 2 - 3, n - 13, n / 2 + 3, n - 13, 1);
  }
  return c;
};
export { draw };
