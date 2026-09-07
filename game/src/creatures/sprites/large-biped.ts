import { canvasFor, ellipse, line, rect, proportions } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    p = proportions(s),
    step = f === 'walk0' ? 2 : f === 'walk1' ? -2 : 0,
    l = f === 'execute' ? 2 : 0;
  ellipse(
    c,
    n / 2 + l,
    n - 18 - p.height,
    facing === 'side' ? 6 + p.length : 5 + p.length / 2,
    6 + p.height / 2,
    1,
  );
  ellipse(c, n / 2 + (facing === 'side' ? 5 : 0) + l, n - 26 - p.height, 4 + p.head, 4, 2);
  rect(c, n / 2 - 4 + l, n - 16, 3, 16 + step, 1);
  rect(c, n / 2 + 2 + l, n - 16, 3, 16 - step, 1);
  line(c, n / 2 - 4, n - 18, n / 2 - 8, n - 10 + (f === 'execute' ? -4 : 0), 2);
  line(c, n / 2 + 4, n - 18, n / 2 + 8 + l, n - 10, 2);
  if (facing === 'down') {
    c.set(n / 2 - 2 + l, n - 27 - p.height, 3);
    c.set(n / 2 + 2 + l, n - 27 - p.height, 3);
  } else if (facing === 'up')
    line(c, n / 2 - 3, n - 25 - p.height, n / 2 + 3, n - 25 - p.height, 1);
  return c;
};
export { draw };
