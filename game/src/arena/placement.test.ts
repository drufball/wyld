import { describe, expect, it } from 'vitest';
import { entryTile } from '../combat/reserve.js';
import { buildArena } from '../scenarios/scenarios.js';
import { arenaPlacement } from './placement.js';

describe('arena placement', () => {
  it.each([
    [7, 16],
    [5, 12],
    [11, 22],
  ])('keeps combatants walkable and separated in a %d by %d arena', (cols, rows) => {
    const grid = buildArena(cols, rows);
    const placement = arenaPlacement(cols, rows, grid.isWalkable);
    for (const tile of [placement.centre, ...placement.party, placement.enemy]) {
      expect(tile.tx).toBeGreaterThanOrEqual(0);
      expect(tile.tx).toBeLessThan(cols);
      expect(tile.ty).toBeGreaterThanOrEqual(0);
      expect(tile.ty).toBeLessThan(rows);
      expect(grid.isWalkable(tile.tx, tile.ty)).toBe(true);
    }
    expect(new Set(placement.party.map(({ tx, ty }) => `${tx},${ty}`))).toHaveLength(3);
    expect(placement.party).not.toContainEqual(placement.centre);
    expect(
      Math.hypot(
        placement.enemy.tx - placement.centre.tx,
        placement.enemy.ty - placement.centre.ty,
      ),
    ).toBeGreaterThanOrEqual(6);
  });

  it("keeps the reserve's entry tile safe in the 7 by 16 arena", () => {
    const grid = buildArena(7, 16);
    const { centre: fallen, enemy } = arenaPlacement(7, 16, grid.isWalkable);
    const entry = entryTile({
      fallen: { x: fallen.tx + 0.5, y: fallen.ty + 0.5 },
      enemy: { x: enemy.tx + 0.5, y: enemy.ty + 0.5 },
      isWalkable: grid.isWalkable,
      occupied: [],
    });
    expect(entry.x).toBeGreaterThanOrEqual(0);
    expect(entry.x).toBeLessThan(7);
    expect(entry.y).toBeGreaterThanOrEqual(0);
    expect(entry.y).toBeLessThan(16);
    expect(grid.isWalkable(Math.floor(entry.x), Math.floor(entry.y))).toBe(true);
    expect(Math.hypot(entry.x - enemy.tx - 0.5, entry.y - enemy.ty - 0.5)).toBeGreaterThanOrEqual(
      Math.hypot(fallen.tx - enemy.tx, fallen.ty - enemy.ty),
    );
  });
});
