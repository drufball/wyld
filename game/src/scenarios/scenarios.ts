import type { Temperament } from '../creatures/species.js';
import type { Phase } from '../world/time.js';
import type { Tile, TileGrid } from '../world/tiles.js';

type Scenario = {
  id: string;
  goal: string;
  start: { tx: number; ty: number };
  phase: Phase;
  party: string[];
  spawns: { speciesId: string; tx: number; ty: number; temperament?: Temperament }[];
};
const scenarios: readonly Scenario[] = [
  {
    id: 'world',
    goal: 'Walk to the pond.',
    start: { tx: 125, ty: 225 },
    phase: 'Day',
    party: ['loamox'],
    spawns: [],
  },
  {
    id: 'creatures',
    goal: 'Get close to the bird without it seeing you.',
    start: { tx: 125, ty: 225 },
    phase: 'Dusk',
    party: ['loamox'],
    spawns: [
      { speciesId: 'thornwren', tx: 133, ty: 225 },
      { speciesId: 'bramblehog', tx: 135, ty: 228 },
      { speciesId: 'bramblehog', tx: 137, ty: 222 },
    ],
  },
  {
    id: 'guide',
    goal: 'Fill a page in the field guide.',
    start: { tx: 151, ty: 216 },
    phase: 'Dusk',
    party: ['loamox'],
    spawns: [
      { speciesId: 'mirefin', tx: 156, ty: 216 },
      { speciesId: 'bramblehog', tx: 158, ty: 219 },
    ],
  },
  {
    id: 'party',
    goal: 'Send each of your creatures somewhere.',
    start: { tx: 125, ty: 225 },
    phase: 'Day',
    party: ['loamox', 'bramblehog', 'mirefin'],
    spawns: [],
  },
  {
    id: 'arena',
    goal: 'Send each of your creatures somewhere.',
    start: { tx: 10, ty: 6 },
    phase: 'Day',
    party: ['loamox', 'bramblehog', 'mirefin'],
    spawns: [],
  },
];
const scenarioFromQuery = (query: string): Scenario | null => {
  const id = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query).get('scenario');
  return scenarios.find((scenario) => scenario.id === id) ?? null;
};
const arenaRockTiles = new Set(['3,3', '7,2', '12,4', '16,3', '6,9', '14,8']);
const buildArena = (): TileGrid & { width: 20; height: 12; screenFlipping: false } => {
  const grass: Tile = { class: 'walkable', surface: 'grass', biome: 'forest' };
  const rock: Tile = { class: 'cover', surface: 'rock', biome: 'forest' };
  const outside: Tile = { class: 'cliff', surface: 'rock', biome: 'forest' };
  const tileAt = (tx: number, ty: number): Tile =>
    tx < 0 || ty < 0 || tx >= 20 || ty >= 12
      ? outside
      : arenaRockTiles.has(`${tx},${ty}`)
        ? rock
        : grass;
  return {
    width: 20,
    height: 12,
    screenFlipping: false,
    data: new Uint8Array(20 * 12 * 3),
    tileAt,
    isWalkable: (tx, ty) => tileAt(tx, ty).class === 'walkable',
    blocksSight: (tx, ty) => tileAt(tx, ty).class !== 'walkable',
    regionAt: () => null,
  };
};

export { buildArena, scenarioFromQuery, scenarios };
export type { Scenario };
