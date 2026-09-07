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
  synthetic?: boolean;
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
    goal: 'A flat place to practise. Nothing lives here yet.',
    start: { tx: 0, ty: 0 },
    phase: 'Day',
    party: ['loamox', 'bramblehog', 'mirefin'],
    spawns: [],
    synthetic: true,
  },
];
const scenarioFromQuery = (query: string): Scenario | null => {
  const id = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query).get('scenario');
  return scenarios.find((scenario) => scenario.id === id) ?? null;
};
const buildArena = (
  cols: number,
  rows: number,
): TileGrid & { width: number; height: number; screenFlipping: false } => {
  const grass: Tile = { class: 'walkable', surface: 'grass', biome: 'forest' };
  const rock: Tile = { class: 'cover', surface: 'rock', biome: 'forest' };
  const outside: Tile = { class: 'cliff', surface: 'rock', biome: 'forest' };
  const rockPositions: readonly (readonly [number, number])[] = [
    [0.2, 0.25],
    [0.5, 0.18],
    [0.78, 0.3],
    [0.25, 0.72],
    [0.55, 0.8],
    [0.82, 0.68],
  ];
  const rockTiles = new Set(
    rockPositions.map(
      ([x, y]) =>
        `${Math.min(cols - 1, Math.floor(cols * x))},${Math.min(rows - 1, Math.floor(rows * y))}`,
    ),
  );
  const tileAt = (tx: number, ty: number): Tile =>
    tx < 0 || ty < 0 || tx >= cols || ty >= rows
      ? outside
      : rockTiles.has(`${tx},${ty}`)
        ? rock
        : grass;
  return {
    width: cols,
    height: rows,
    screenFlipping: false,
    data: new Uint8Array(cols * rows * 3),
    tileAt,
    isWalkable: (tx, ty) => tileAt(tx, ty).class === 'walkable',
    blocksSight: (tx, ty) => tileAt(tx, ty).class !== 'walkable',
    regionAt: () => null,
  };
};

export { buildArena, scenarioFromQuery, scenarios };
export type { Scenario };
