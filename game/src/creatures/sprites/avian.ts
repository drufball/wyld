import { canvasFor, ellipse, line, proportions } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    p = proportions(s),
    wing = f === 'walk0' ? 5 : f === 'walk1' ? 2 : 3,
    l = f === 'execute' ? 2 : 0;
  ellipse(c, n / 2, n - 1, 2 + p.length, 0.5, 2);
  if (facing === 'side') {
    ellipse(c, n / 2 + l, n - 7, 4 + p.length, 2 + p.height / 2, 1);
    ellipse(c, n / 2 + 4 + p.length / 2 + l, n - 9, 1 + p.head, 1 + p.head, 2);
    line(c, n / 2 - 3, n - 7, n / 2 - 7, n - 9, 2);
    c.set(n / 2 + 7 + l, n - 9, 3);
  } else {
    ellipse(c, n / 2 + l, n - 7, 2 + p.height / 2, 3 + p.length / 2, 1);
    line(c, n / 2, n - 7, n / 2 - wing - p.length, n - 10, 2);
    line(c, n / 2, n - 7, n / 2 + wing + p.length, n - 10, 2);
    if (facing === 'down') {
      c.set(n / 2 - 1 + l, n - 9, 3);
      c.set(n / 2 + 1 + l, n - 9, 3);
    } else line(c, n / 2 - 2, n - 9, n / 2 + 2, n - 9, 2);
  }
  return c;
};
export { draw };
