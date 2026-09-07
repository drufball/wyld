import { camps, pointToRegion, regions } from './regions.js';
import type { Biome, Region } from './regions.js';
import type { PropPlacement } from './props.js';

const TILE_METRES = 2;
const TILES_PER_SIDE = 400;
type TileClass = 'walkable' | 'water' | 'cliff' | 'cover' | 'hazard';
type Surface = 'grass' | 'fern' | 'water' | 'sand' | 'salt' | 'rock' | 'ash' | 'vent' | 'path';
type Tile = { class: TileClass; surface: Surface; biome: Biome };
type TileGridOptions = {
  heightAt(x: number, z: number): number;
  slopeAt(x: number, z: number): number;
  depthAt(x: number, z: number): number;
  biomeAt(x: number, z: number): Biome;
  propPlacements: readonly PropPlacement[];
};
type TileGrid = {
  readonly data: Uint8Array;
  tileAt(tx: number, ty: number): Tile;
  isWalkable(tx: number, ty: number): boolean;
  blocksSight(tx: number, ty: number): boolean;
  regionAt(tx: number, ty: number): Region | null;
};
const classes: readonly TileClass[] = ['walkable', 'water', 'cliff', 'cover', 'hazard'];
const surfaces: readonly Surface[] = [
  'grass',
  'fern',
  'water',
  'sand',
  'salt',
  'rock',
  'ash',
  'vent',
  'path',
];
const biomes: readonly Biome[] = ['forest', 'desert', 'archipelago', 'volcano'];
const clampTile = (value: number): number => Math.max(0, Math.min(TILES_PER_SIDE - 1, value));
const worldToTile = (x: number, z: number) => ({
  tx: clampTile(Math.floor((x + 400) / TILE_METRES)),
  ty: clampTile(Math.floor((z + 400) / TILE_METRES)),
});
const tileToWorld = (tx: number, ty: number) => ({
  x: -400 + (tx + 0.5) * TILE_METRES,
  z: -400 + (ty + 0.5) * TILE_METRES,
});
const outside = (tx: number, ty: number): boolean =>
  !Number.isInteger(tx) ||
  !Number.isInteger(ty) ||
  tx < 0 ||
  ty < 0 ||
  tx >= TILES_PER_SIDE ||
  ty >= TILES_PER_SIDE;
const outTile: Tile = { class: 'cliff', surface: 'rock', biome: 'volcano' };
const createTileGrid = (options: TileGridOptions): TileGrid => {
  const data = new Uint8Array(TILES_PER_SIDE * TILES_PER_SIDE * 3);
  const propMap = new Map<number, Set<PropPlacement['kind']>>();
  for (const prop of options.propPlacements) {
    const { tx, ty } = worldToTile(prop.x, prop.z);
    const key = ty * TILES_PER_SIDE + tx;
    const kinds = propMap.get(key) ?? new Set<PropPlacement['kind']>();
    kinds.add(prop.kind);
    propMap.set(key, kinds);
  }
  const salt = regions().find(({ id }) => id === 'salt-flats');
  for (let ty = 0; ty < TILES_PER_SIDE; ty += 1)
    for (let tx = 0; tx < TILES_PER_SIDE; tx += 1) {
      const { x, z } = tileToWorld(tx, ty);
      const slope = options.slopeAt(x, z);
      const biome = options.biomeAt(x, z);
      const kinds = propMap.get(ty * TILES_PER_SIDE + tx);
      let tileClass: TileClass;
      if (
        ['conifer', 'broadleaf', 'rock', 'cactus', 'mesa'].some((kind) =>
          kinds?.has(kind as PropPlacement['kind']),
        )
      )
        tileClass = 'cover';
      else if (kinds?.has('vent')) tileClass = 'hazard';
      else if (options.depthAt(x, z) > 0.6) tileClass = 'water';
      else if (slope > 45) tileClass = 'cliff';
      else tileClass = 'walkable';
      // Drawing precedence: water/hazard, camp paths, steep rock, then biome details.
      let surface: Surface;
      if (tileClass === 'water') surface = 'water';
      else if (tileClass === 'hazard') surface = 'vent';
      else if (
        tileClass === 'walkable' &&
        camps().some((camp) => Math.hypot(x - camp.x, z - camp.z) <= 3 * TILE_METRES)
      )
        surface = 'path';
      else if (slope > 30) surface = 'rock';
      else if (biome === 'forest') surface = kinds?.has('fern') ? 'fern' : 'grass';
      else if (biome === 'desert')
        surface = salt && Math.hypot(x - salt.x, z - salt.z) <= salt.radius ? 'salt' : 'sand';
      else if (biome === 'archipelago') surface = 'sand';
      else surface = 'ash';
      const offset = (ty * TILES_PER_SIDE + tx) * 3;
      data[offset] = classes.indexOf(tileClass);
      data[offset + 1] = surfaces.indexOf(surface);
      data[offset + 2] = biomes.indexOf(biome);
    }
  const tileAt = (tx: number, ty: number): Tile => {
    if (outside(tx, ty)) return outTile;
    const o = (ty * TILES_PER_SIDE + tx) * 3;
    return {
      class: classes[data[o]!]!,
      surface: surfaces[data[o + 1]!]!,
      biome: biomes[data[o + 2]!]!,
    };
  };
  return {
    data,
    tileAt,
    isWalkable: (tx, ty) => ['walkable', 'hazard'].includes(tileAt(tx, ty).class),
    blocksSight: (tx, ty) => ['cover', 'cliff'].includes(tileAt(tx, ty).class),
    regionAt: (tx, ty) => {
      const p = tileToWorld(tx, ty);
      return outside(tx, ty) ? null : pointToRegion(p.x, p.z);
    },
  };
};
export { TILE_METRES, TILES_PER_SIDE, createTileGrid, tileToWorld, worldToTile };
export type { Surface, Tile, TileClass, TileGrid, TileGridOptions };
