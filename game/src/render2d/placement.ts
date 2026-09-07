const TILE_PX = 16;

const spriteOrigin = (
  tileX: number,
  tileY: number,
  width: number,
  height: number,
): { x: number; y: number } => ({
  x: Math.round(tileX * TILE_PX - width / 2),
  y: Math.round(tileY * TILE_PX + TILE_PX / 2 - height),
});

export { spriteOrigin, TILE_PX };
