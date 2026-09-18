import { TILES_PER_SIDE } from '../world/tiles.js';
import { clamp } from './clamp.js';
import { pickSpriteAt, TILE_PX, type PickSprite } from './placement.js';

const pixelScale = (vw: number, vh: number, forced?: number | null) =>
  forced === 2 || forced === 3 || forced === 4
    ? forced
    : clamp(Math.floor(Math.min(vw, vh) / 125), 2, 4);
// Five columns lets 375px screens fit scale 3 (7 columns) and forced scale 4 (5 columns)
// without the old eight-column floor making the canvas wider than the viewport.
const screenCols = (vw: number, scale: number) => clamp(Math.floor(vw / (TILE_PX * scale)), 5, 20);
const screenRows = (vh: number, scale: number) => clamp(Math.floor(vh / (TILE_PX * scale)), 8, 22);
const scaleFromQuery = (search: string): 2 | 3 | 4 | null => {
  const scale = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('scale');
  return scale === '2' || scale === '3' || scale === '4' ? (Number(scale) as 2 | 3 | 4) : null;
};
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
) => ({ tx: sx * cols + Math.floor(px / TILE_PX), ty: sy * rows + Math.floor(py / TILE_PX) });
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
const createCanvas = (
  options: {
    screen?: () => { sx: number; sy: number };
    resized?: (rect: DOMRect) => void;
    scale?: number | null;
  } = {},
) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  let scale = 2,
    cols = 8,
    rows = 8;
  const resize = () => {
    scale = pixelScale(innerWidth, innerHeight, options.scale);
    cols = screenCols(innerWidth, scale);
    rows = screenRows(innerHeight, scale);
    canvas.width = cols * TILE_PX;
    canvas.height = rows * TILE_PX;
    canvas.style.cssText = `width:${canvas.width * scale}px;height:${canvas.height * scale}px;image-rendering:pixelated`;
    context.imageSmoothingEnabled = false;
    options.resized?.(canvas.getBoundingClientRect());
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
    pickBody(clientX: number, clientY: number, bodies: readonly PickSprite[]) {
      const rect = canvas.getBoundingClientRect();
      const px = ((clientX - rect.left) * canvas.width) / rect.width;
      const py = ((clientY - rect.top) * canvas.height) / rect.height;
      return pickSpriteAt(px, py, bodies, 4);
    },
  };
};
export {
  canvasPixelToTile,
  createCanvas,
  crossedScreen,
  pixelScale,
  scaleFromQuery,
  screenCols,
  screenOf,
  screenRows,
};
