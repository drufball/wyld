type Position = { x: number; y: number; z: number };
type BuildStateOptions = {
  version: string;
  elapsedSeconds: number;
  player: Position;
  screen: { x: number; y: number };
  tile: { x: number; y: number };
  seed: number;
  region: string | null;
  biome: WyldGameState['biome'];
  phase: WyldGameState['phase'];
  day: number;
  phaseProgress: number;
  waterDepth: number;
  guide?: WyldGameState['guide'];
  observe?: WyldGameState['observe'];
  creatures?: WyldGameState['creatures'];
  party?: WyldGameState['party'];
  selection?: string;
  target?: WyldGameState['target'];
  arena?: WyldGameState['arena'];
  combat?: WyldGameState['combat'];
  autopilot?: WyldGameState['autopilot'];
  orders?: WyldGameState['orders'];
};
const buildState = (o: BuildStateOptions): WyldGameState => ({
  version: o.version,
  elapsedSeconds: o.elapsedSeconds,
  player: { ...o.player },
  screen: { ...o.screen },
  tile: { ...o.tile },
  seed: o.seed,
  region: o.region,
  biome: o.biome,
  phase: o.phase,
  day: o.day,
  phaseProgress: o.phaseProgress,
  waterDepth: o.waterDepth,
  arena: structuredClone(o.arena ?? null),
  combat: structuredClone(o.combat ?? null),
  autopilot: structuredClone(o.autopilot ?? []),
  orders: structuredClone(o.orders ?? []),
  creatures: structuredClone(o.creatures ?? []),
  party: structuredClone(o.party ?? []),
  selection: o.selection ?? 'player',
  target: structuredClone(o.target ?? null),
  guide: structuredClone(
    o.guide ?? {
      open: false,
      tab: 'index',
      completion: 0,
      pages: [],
      stubs: [],
      fog: { revealed: 0, total: 1600 },
      camps: [],
    },
  ),
  observe: structuredClone(o.observe ?? { identifying: { species: null, progress: 0 } }),
});
export { buildState };
