const FOG_CELL_METRES = 20;
const FOG_REVEAL_METRES = 40;
const FOG_COLUMNS = 40;
const FOG_CELLS = FOG_COLUMNS * FOG_COLUMNS;
const WORLD_MIN = -400;
const WORLD_MAX = 400;

const cellIndexAt = (x: number, z: number): number | null => {
  if (x < WORLD_MIN || x > WORLD_MAX || z < WORLD_MIN || z > WORLD_MAX) return null;
  const column = Math.min(FOG_COLUMNS - 1, Math.floor((x - WORLD_MIN) / FOG_CELL_METRES));
  const row = Math.min(FOG_COLUMNS - 1, Math.floor((z - WORLD_MIN) / FOG_CELL_METRES));
  return row * FOG_COLUMNS + column;
};

const cellCentre = (index: number): { x: number; z: number } => {
  if (!Number.isInteger(index) || index < 0 || index >= FOG_CELLS)
    throw new RangeError(`Invalid fog cell: ${index}`);
  return {
    x: WORLD_MIN + ((index % FOG_COLUMNS) + 0.5) * FOG_CELL_METRES,
    z: WORLD_MIN + (Math.floor(index / FOG_COLUMNS) + 0.5) * FOG_CELL_METRES,
  };
};

type Fog = ReturnType<typeof createFog>;

const createFog = (initial: readonly number[] = []) => {
  const revealed = new Set(
    initial.filter((index) => Number.isInteger(index) && index >= 0 && index < FOG_CELLS),
  );
  return {
    reveal(x: number, z: number): number[] {
      const newly: number[] = [];
      // A cell is revealed iff its centre is within 40 metres. Only the nearby
      // five-by-five neighbourhood can qualify, so this never scans all 1600 cells.
      const centreIndex = cellIndexAt(x, z);
      if (centreIndex === null) return newly;
      const centreColumn = centreIndex % FOG_COLUMNS;
      const centreRow = Math.floor(centreIndex / FOG_COLUMNS);
      for (
        let row = Math.max(0, centreRow - 2);
        row <= Math.min(FOG_COLUMNS - 1, centreRow + 2);
        row += 1
      )
        for (
          let column = Math.max(0, centreColumn - 2);
          column <= Math.min(FOG_COLUMNS - 1, centreColumn + 2);
          column += 1
        ) {
          const index = row * FOG_COLUMNS + column;
          const cell = cellCentre(index);
          if (Math.hypot(cell.x - x, cell.z - z) <= FOG_REVEAL_METRES && !revealed.has(index)) {
            revealed.add(index);
            newly.push(index);
          }
        }
      return newly.sort((a, b) => a - b);
    },
    isRevealed: (index: number): boolean => revealed.has(index),
    revealAll(): void {
      for (let index = 0; index < FOG_CELLS; index += 1) revealed.add(index);
    },
    revealedCount: (): number => revealed.size,
    toJSON: (): number[] => [...revealed].sort((a, b) => a - b),
  };
};

export {
  FOG_CELL_METRES,
  FOG_CELLS,
  FOG_COLUMNS,
  FOG_REVEAL_METRES,
  cellCentre,
  cellIndexAt,
  createFog,
};
export type { Fog };
