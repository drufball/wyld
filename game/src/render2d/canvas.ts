const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const pixelScale = (vw: number, vh: number) => clamp(Math.floor(Math.min(vw, vh) / 200), 2, 4);
const screenCols = (vw: number, scale: number) => clamp(Math.floor(vw / (16 * scale)), 8, 20);
const screenRows = (vh: number, scale: number) =>
  clamp(Math.floor(vh / (16 * scale)), 8, scale >= 3 ? 12 : 22);
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
  if (tx < 0 || ty < 0 || tx >= 400 || ty >= 400) return from;
  return screenOf(tx, ty, cols, rows);
};
const createCanvas = () => {
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
