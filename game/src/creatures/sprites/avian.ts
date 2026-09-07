import { canvasFor, ellipse, line, variation } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, _facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    v = variation(s),
    wing = f === 'walk0' ? 5 : f === 'walk1' ? 2 : 3,
    l = f === 'execute' ? 2 : 0;
  ellipse(c, n / 2, n - 1, 4 + v, 1, 2);
  ellipse(c, n / 2 + l, n - 7, 3, 3, 1);
  line(c, n / 2, n - 7, n / 2 - wing, n - 10, 2);
  line(c, n / 2, n - 7, n / 2 + wing, n - 10, 2);
  c.set(n / 2 + 4 + l, n - 7, 3);
  return c;
};
export { draw };
