import { canvasFor, ellipse, line, rect, variation } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, _facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    v = variation(s),
    step = f === 'walk0' ? 1 : f === 'walk1' ? -1 : 0,
    l = f === 'execute' ? 2 : 0;
  ellipse(c, n / 2 + l, n - 5, 5 + v, 2, 1);
  rect(c, n / 2 + 4 + l, n - 7, 3, 3, 2);
  for (let i = -1; i <= 1; i++) {
    line(c, n / 2 + i * 3, n - 4, 2 + i * 3, n - 1 + (i % 2 ? step : -step), 2);
    line(c, n / 2 + i * 3, n - 4, n - 3 + i * 3, n - 1 - (i % 2 ? step : -step), 2);
  }
  return c;
};
export { draw };
