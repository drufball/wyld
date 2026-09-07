type Facing = 'down' | 'up' | 'side';
type Frame = 0 | 1 | 'idle';
type PixelSprite = { width: number; height: number; palette: readonly string[]; grid: Uint8Array };
const playerSprite = (facing: Facing, frame: Frame): PixelSprite => {
  const width = 16,
    height = 24,
    grid = new Uint8Array(width * height);
  const set = (x: number, y: number, w: number, h: number, c: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy * width + xx] = c;
  };
  set(5, 1, 6, 6, 2);
  set(4, 7, 8, 9, 1);
  set(3, 9, 2, 7, 2);
  set(11, 9, 2, 7, 2);
  const step = frame === 1 ? 1 : 0;
  set(5 - step, 16, 3, 7, 3);
  set(8 + step, 16, 3, 7, 3);
  if (facing === 'up') set(5, 1, 6, 3, 3);
  if (facing === 'side') set(9, 3, 3, 2, 2);
  return { width, height, palette: ['', '#315c54', '#c98962', '#263234'], grid };
};
export { playerSprite };
export type { Facing, Frame, PixelSprite };
