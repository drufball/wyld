import { canvasFor, ellipse, proportions } from './draw.js';
import type { Painter } from './types.js';
const draw: Painter = (s, facing, f) => {
  const c = canvasFor(s),
    n = c.width,
    p = proportions(s),
    l = f === 'execute' ? 2 : 0;
  const segments = 8 + p.length * 2;
  for (let i = 0; i < segments; i++) {
    const progress = i / Math.max(1, segments - 1),
      phase = i + (f === 'walk1' ? 2 : 0),
      x =
        facing === 'side'
          ? 2 + progress * (n - 6)
          : n / 2 + Math.sin(phase * 0.9) * (3 + p.length / 2),
      y =
        facing === 'side'
          ? n - 2 - Math.sin(progress * Math.PI * 2) * 3
          : n - 2 - progress * (9 + p.height);
    ellipse(
      c,
      x + l * (1 - progress),
      y,
      i === segments - 1 ? 2 + p.head : 1.5,
      i === segments - 1 ? 2 + p.head : 1.5,
      i >= segments - 2 ? 2 : 1,
    );
  }
  if (facing === 'down') c.set(n / 2 + 2 + l, n - 11 - p.height, 3);
  else if (facing === 'side') c.set(n - 2 + l, n - 3, 3);
  return c;
};
export { draw };
