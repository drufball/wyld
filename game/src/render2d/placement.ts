const TILE_PX = 16;
type PickSprite = { key: string; tileX: number; tileY: number; sizePx: number };

const spriteOrigin = (
  tileX: number,
  tileY: number,
  width: number,
  height: number,
): { x: number; y: number } => ({
  x: Math.round(tileX * TILE_PX - width / 2),
  y: Math.round(tileY * TILE_PX + TILE_PX / 2 - height),
});
const pickSpriteAt = (
  px: number,
  py: number,
  sprites: readonly PickSprite[],
  padPx: number,
): string | null => {
  const hits = sprites.filter((sprite) => {
    const origin = spriteOrigin(sprite.tileX, sprite.tileY, sprite.sizePx, sprite.sizePx);
    return (
      px >= origin.x - padPx &&
      px <= origin.x + sprite.sizePx + padPx &&
      py >= origin.y - padPx &&
      py <= origin.y + sprite.sizePx + padPx
    );
  });
  hits.sort((a, b) => b.tileY - a.tileY || b.tileX - a.tileX);
  return hits[0]?.key ?? null;
};

export { pickSpriteAt, spriteOrigin, TILE_PX };
export type { PickSprite };
