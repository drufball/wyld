export const TILT_FROM_VERTICAL = (50 * Math.PI) / 180;
export const ELEVATION = Math.PI / 2 - TILT_FROM_VERTICAL;
export const TALL_TILES = 1.6;
type Screen = { x: number; y: number };
type Slide = { from: { sx: number; sy: number }; to: { sx: number; sy: number }; progress: number };
type Frustum = { halfWidth: number; halfHeight: number };
const screenCentre = (screen: Screen, cols: number, rows: number) => ({
  x: screen.x * cols + cols / 2,
  z: screen.y * rows + rows / 2,
});
const cameraTarget = (screen: Screen, sliding: Slide | null, cols: number, rows: number) => {
  if (!sliding) return screenCentre(screen, cols, rows);
  const from = screenCentre({ x: sliding.from.sx, y: sliding.from.sy }, cols, rows);
  const to = screenCentre({ x: sliding.to.sx, y: sliding.to.sy }, cols, rows);
  const t = Math.max(0, Math.min(1, sliding.progress));
  const eased = t * t * (3 - 2 * t);
  return { x: from.x + (to.x - from.x) * eased, z: from.z + (to.z - from.z) * eased };
};
const cameraOffset = (distance: number) => ({
  x: 0,
  y: distance * Math.sin(ELEVATION),
  z: distance * Math.cos(ELEVATION),
});
const orthoFrustum = (cols: number, rows: number): Frustum => ({
  halfWidth: cols / 2,
  halfHeight: (rows * Math.sin(ELEVATION) + TALL_TILES * Math.cos(ELEVATION)) / 2,
});
const projectTile = (
  tileX: number,
  tileZ: number,
  tileY: number,
  target: { x: number; z: number },
  frustum: Frustum,
) => ({
  ndcX: (tileX - target.x) / frustum.halfWidth,
  ndcY:
    (tileY * Math.cos(TILT_FROM_VERTICAL) - (tileZ - target.z) * Math.sin(ELEVATION)) /
    frustum.halfHeight,
});
const pickTileFromNdc = (
  ndcX: number,
  ndcY: number,
  target: { x: number; z: number },
  frustum: Frustum,
) => ({
  tx: Math.floor(target.x + ndcX * frustum.halfWidth),
  ty: Math.floor(target.z - (ndcY * frustum.halfHeight) / Math.sin(ELEVATION)),
});
export { cameraOffset, cameraTarget, orthoFrustum, pickTileFromNdc, projectTile, screenCentre };
