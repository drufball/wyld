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

const creatureBarWidth = (tier: 1 | 2 | 3): number => ({ 1: 16, 2: 24, 3: 32 })[tier];

const healthColour = (value: number, max: number): string => {
  const fraction = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return fraction < 0.25 ? '#d6453a' : fraction < 0.5 ? '#e2963a' : '#6fbf3f';
};

const combatFootBarOrigin = (
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
  return { x: origin.x, y: origin.y + spriteSize + 1 };
};

export { combatBarOrigin, combatFootBarOrigin, creatureBarWidth, healthColour };
