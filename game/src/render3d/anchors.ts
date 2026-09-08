import { projectTile } from './camera.js';

type AnchorRect = { left: number; top: number; width: number; height: number };
const anchorFor = (
  tileX: number,
  tileY: number,
  tileHeight: number,
  target: { x: number; z: number },
  frustum: { halfWidth: number; halfHeight: number },
  rect: AnchorRect,
) => {
  const { ndcX, ndcY } = projectTile(tileX, tileY, tileHeight, target, frustum);
  return {
    left: rect.left + ((ndcX + 1) / 2) * rect.width,
    top: rect.top + ((1 - ndcY) / 2) * rect.height,
  };
};
export { anchorFor };
export type { AnchorRect };
