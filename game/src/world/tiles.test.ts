import { describe, expect, it } from 'vitest';
import { createTileGrid, tileToWorld, worldToTile } from './tiles.js';
import type { TileGridOptions } from './tiles.js';
import type { PropKind, PropPlacement } from './props.js';
const placement = (kind: PropKind, x = 1, z = 1): PropPlacement => ({
  kind,
  x,
  z,
  y: 0,
  rotationY: 0,
  scale: 1,
});
const fixture = (overrides: Partial<TileGridOptions> = {}) =>
  createTileGrid({
    heightAt: () => 0,
    slopeAt: () => 0,
    depthAt: () => 0,
    biomeAt: () => 'forest',
    propPlacements: [],
    ...overrides,
  });
describe('tile world', () => {
  it('converts world metres to tiles and back to tile centres', () => {
    expect(worldToTile(0, 0)).toEqual({ tx: 200, ty: 200 });
    expect(tileToWorld(200, 200)).toEqual({ x: 1, z: 1 });
  });
  it('classifies water tiles as blocking walking but not sight', () => {
    const grid = fixture({ depthAt: () => 1 });
    expect(grid.isWalkable(200, 200)).toBe(false);
    expect(grid.blocksSight(200, 200)).toBe(false);
  });
  it('classifies cliff tiles as blocking walking and sight', () => {
    const grid = fixture({ slopeAt: () => 50 });
    expect(grid.tileAt(200, 200).surface).toBe('cliff');
    expect([grid.isWalkable(200, 200), grid.blocksSight(200, 200)]).toEqual([false, true]);
  });
  it('classifies trees as blocking walking and sight', () => {
    const grid = fixture({ propPlacements: [placement('conifer')] });
    expect(grid.tileAt(200, 200)).toMatchObject({ class: 'cover', surface: 'tree' });
    expect([grid.isWalkable(200, 200), grid.blocksSight(200, 200)]).toEqual([false, true]);
  });
  it('classifies rocks as blocking walking but not sight', () => {
    const grid = fixture({ propPlacements: [placement('rock')] });
    expect(grid.tileAt(200, 200)).toMatchObject({ class: 'cover', surface: 'rock' });
    expect([grid.isWalkable(200, 200), grid.blocksSight(200, 200)]).toEqual([false, false]);
  });
  it('classifies vent tiles as walkable hazards', () => {
    const grid = fixture({ propPlacements: [placement('vent')] });
    expect(grid.tileAt(200, 200).class).toBe('hazard');
    expect(grid.isWalkable(200, 200)).toBe(true);
  });
  it('treats out-of-bounds tiles as blocking cliff', () => {
    const grid = fixture();
    expect(grid.tileAt(-1, 0).class).toBe('cliff');
    expect(grid.blocksSight(-1, 0)).toBe(true);
  });
  it('picks a surface per biome including salt flats, ferns and camp paths', () => {
    const grid = fixture({
      biomeAt: (x) =>
        x < -100 ? 'forest' : x < 100 ? 'archipelago' : x < 250 ? 'volcano' : 'desert',
      propPlacements: [placement('fern', -201, 1)],
    });
    expect(grid.tileAt(99, 200).surface).toBe('fern');
    expect(grid.tileAt(200, 200).surface).toBe('sand');
    expect(grid.tileAt(300, 200).surface).toBe('ash');
    expect(grid.tileAt(350, 170).surface).toBe('salt');
    expect(grid.tileAt(125, 225).surface).toBe('path');
  });
  it('returns the same grid for the same seed', () => {
    const options = { propPlacements: [placement('rock')] };
    expect(fixture(options).data).toEqual(fixture(options).data);
  });
  it('looks a tile up to its region', () => {
    expect(fixture().regionAt(125, 225)?.id).toBe('hollow');
    expect(fixture().regionAt(-1, 0)).toBeNull();
  });
});
