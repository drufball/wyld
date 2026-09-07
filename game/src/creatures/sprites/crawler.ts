import { canvasFor, ellipse, line, rect, proportions } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    p = proportions(s),
    step = f === 'walk0' ? 1 : f === 'walk1' ? -1 : 0,
    l = f === 'execute' ? 2 : 0;
  ellipse(
    c,
    n / 2 + l,
    n - 5,
    facing === 'side' ? 6 + p.length : 4 + p.height,
    2 + p.height / 2,
    1,
  );
  rect(c, n / 2 + (facing === 'side' ? 5 + p.length : 0) + l, n - 8, 3 + p.head, 3, 2);
  for (let i = -1; i <= 1; i++) {
    line(c, n / 2 + i * 3, n - 4, 2 + i * 3, n - 1 + (i % 2 ? step : -step), 2);
    line(c, n / 2 + i * 3, n - 4, n - 3 + i * 3, n - 1 - (i % 2 ? step : -step), 2);
  }
  if (facing === 'down') {
    c.set(n / 2 - 1 + l, n - 7, 3);
    c.set(n / 2 + 1 + l, n - 7, 3);
  } else if (facing === 'up') line(c, n / 2 - 3, n - 6, n / 2 + 3, n - 6, 2);
  return c;
};
export { draw };
