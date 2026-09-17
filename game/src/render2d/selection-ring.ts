const drawSelectionRing = (
  context: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  colour: string,
): void => {
  context.strokeStyle = colour;
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(Math.round(tileX * 16), Math.round(tileY * 16 + 4), 7, 3, 0, 0, Math.PI * 2);
  context.stroke();
};

export { drawSelectionRing };
