type Position = { x: number; y: number; z: number };

const buildState = (
  version: string,
  elapsedSeconds: number,
  camera: Position,
  player: Position,
  seed: number,
  stance: WyldGameState['stance'],
): WyldGameState => ({
  version,
  elapsedSeconds,
  camera: { x: camera.x, y: camera.y, z: camera.z },
  player: { x: player.x, y: player.y, z: player.z },
  seed,
  stance,
});

export { buildState };
