import type { PixelSprite } from '@wyld/sprites';

type Facing = 'down' | 'up' | 'side';
type Frame = 0 | 1 | 'idle';
type PlayerSprite = PixelSprite & { key: string };
const playerSprite = (facing: Facing, frame: Frame): PlayerSprite => {
  const width = 16,
    height = 24,
    grid = new Uint8Array(width * height);
  const set = (x: number, y: number, w: number, h: number, c: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy * width + xx] = c;
  };
  const bob = frame === 'idle' ? 1 : 0;
  set(4, 1 + bob, 8, 3, 4); // cap and hair make the head readable
  set(5, 4 + bob, 6, 4, 2);
  set(4, 7, 8, 9, 1);
  const swing = frame === 1 ? 2 : 0;
  set(3, 9 + swing, 2, 6, 2);
  set(11, 11 - swing, 2, 6, 2);
  const step = frame === 1 ? 1 : 0;
  set(5 - step, 16, 3, 7, 3);
  set(8 + step, 16, 3, 7, 3);
  if (facing === 'up') set(5, 1, 6, 3, 3);
  if (facing === 'side') set(9, 3, 3, 2, 2);
  if (facing === 'down') set(6, 6 + bob, 4, 1, 5);
  return {
    key: `${facing}:${frame}`,
    width,
    height,
    palette: ['', '#315c54', '#c98962', '#263234', '#7f4938', '#f2d6a2'],
    grid,
  };
};
export { playerSprite };
export type { Facing, Frame, PlayerSprite };
