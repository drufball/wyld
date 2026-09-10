import { TILES_PER_SIDE } from '../world/tiles.js';
import { clamp } from './clamp.js';

const pixelScale = (vw: number, vh: number) => clamp(Math.floor(Math.min(vw, vh) / 200), 2, 4);
const screenCols = (vw: number, scale: number) => clamp(Math.floor(vw / (16 * scale)), 8, 20);
const screenRows = (vh: number, scale: number) => clamp(Math.floor(vh / (16 * scale)), 8, 22);
const screenOf = (tx: number, ty: number, cols: number, rows: number) => ({
  sx: Math.floor(tx / cols),
  sy: Math.floor(ty / rows),
});
const canvasPixelToTile = (
  px: number,
  py: number,
  sx: number,
  sy: number,
  cols: number,
  rows: number,
) => ({ tx: sx * cols + Math.floor(px / 16), ty: sy * rows + Math.floor(py / 16) });
const crossedScreen = (
  tx: number,
  ty: number,
  from: { sx: number; sy: number },
  cols: number,
  rows: number,
) => {
  if (tx < 0 || ty < 0 || tx >= TILES_PER_SIDE || ty >= TILES_PER_SIDE) return from;
  return screenOf(tx, ty, cols, rows);
};
const createCanvas = (options: { screen?: () => { sx: number; sy: number } } = {}) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  let scale = 2,
    cols = 8,
    rows = 8;
  const resize = () => {
    scale = pixelScale(innerWidth, innerHeight);
    cols = screenCols(innerWidth, scale);
    rows = screenRows(innerHeight, scale);
    canvas.width = cols * 16;
    canvas.height = rows * 16;
    canvas.style.cssText = `width:${canvas.width * scale}px;height:${canvas.height * scale}px;image-rendering:pixelated`;
    context.imageSmoothingEnabled = false;
  };
  resize();
  document.body.append(canvas);
  addEventListener('resize', resize);
  return {
    canvas,
    context,
    get scale() {
      return scale;
    },
    get cols() {
      return cols;
    },
    get rows() {
      return rows;
    },
    screenshot: () => canvas.toDataURL('image/jpeg', 0.6),
    pickTile(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      const px = ((clientX - rect.left) * canvas.width) / rect.width;
      const py = ((clientY - rect.top) * canvas.height) / rect.height;
      const screen = options.screen?.() ?? { sx: 0, sy: 0 };
      return canvasPixelToTile(px, py, screen.sx, screen.sy, cols, rows);
    },
  };
};
export {
  canvasPixelToTile,
  createCanvas,
  crossedScreen,
  pixelScale,
  screenCols,
  screenOf,
  screenRows,
};
