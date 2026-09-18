import { TILE_PX } from './placement.js';

const drawSelectionRing = (
  context: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  colour: string,
): void => {
  context.strokeStyle = colour;
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(
    Math.round(tileX * TILE_PX),
    Math.round(tileY * TILE_PX + 4),
    7,
    3,
    0,
    0,
    Math.PI * 2,
  );
  context.stroke();
};

export { drawSelectionRing };
