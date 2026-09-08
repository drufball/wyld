import { spriteOrigin } from './placement.js';

type Screen = { x: number; y: number };
type Tile = { x: number; y: number };

const combatBarOrigin = (
  tile: Tile,
  screen: Screen,
  columns: number,
  rows: number,
  spriteSize: number,
): { x: number; y: number } => {
  const origin = spriteOrigin(
    tile.x - screen.x * columns,
    tile.y - screen.y * rows,
    spriteSize,
    spriteSize,
  );
  return { x: origin.x, y: origin.y - 4 };
};

export { combatBarOrigin };
