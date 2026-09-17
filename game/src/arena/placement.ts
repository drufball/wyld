type Tile = { tx: number; ty: number };

const arenaPlacement = (
  cols: number,
  rows: number,
  isWalkable: (tx: number, ty: number) => boolean,
): { centre: Tile; party: readonly Tile[]; enemy: Tile } => {
  const centre = { tx: Math.floor(cols / 2), ty: Math.floor(rows / 2) };
  const offsets = [
    { tx: 0, ty: 1 },
    { tx: -1, ty: 1 },
    { tx: 1, ty: 1 },
  ];
  const party = offsets.map(({ tx, ty }) => ({ tx: centre.tx + tx, ty: centre.ty + ty }));
  let enemy = { tx: centre.tx, ty: Math.max(0, centre.ty - 6) };
  if (!isWalkable(enemy.tx, enemy.ty)) {
    for (let radius = 1; radius < cols; radius++) {
      const found = [-radius, radius]
        .map((dx) => ({ tx: centre.tx + dx, ty: enemy.ty }))
        .find((tile) => isWalkable(tile.tx, tile.ty));
      if (found) {
        enemy = found;
        break;
      }
    }
  }
  return { centre, party, enemy };
};

export { arenaPlacement };
export type { Tile };
