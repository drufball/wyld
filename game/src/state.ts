type Position = { x: number; y: number; z: number };

type BuildStateOptions = {
  version: string;
  elapsedSeconds: number;
  camera: Position;
  player: Position;
  seed: number;
  stance: WyldGameState['stance'];
  region: string | null;
  biome: WyldGameState['biome'];
  phase: WyldGameState['phase'];
  day: number;
  phaseProgress: number;
  waterDepth: number;
  creatures?: WyldGameState['creatures'];
};

const buildState = ({
  version,
  elapsedSeconds,
  camera,
  player,
  seed,
  stance,
  region,
  biome,
  phase,
  day,
  phaseProgress,
  waterDepth,
  creatures = [],
}: BuildStateOptions): WyldGameState => ({
  version,
  elapsedSeconds,
  camera: { x: camera.x, y: camera.y, z: camera.z },
  player: { x: player.x, y: player.y, z: player.z },
  seed,
  stance,
  region,
  biome,
  phase,
  day,
  phaseProgress,
  waterDepth,
  creatures: creatures.map((creature) => ({
    ...creature,
    position: { ...creature.position },
  })),
});

export { buildState };
