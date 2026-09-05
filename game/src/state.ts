type CameraPosition = WyldGameState['camera'];

const cameraPosition = (elapsedSeconds: number): CameraPosition => {
  const angle = elapsedSeconds * 0.12;

  return {
    x: Math.sin(angle) * 6,
    y: 3.2 + Math.sin(angle * 2) * 0.15,
    z: Math.cos(angle) * 6,
  };
};

const buildState = (
  version: string,
  elapsedSeconds: number,
  camera: CameraPosition,
): WyldGameState => ({
  version,
  elapsedSeconds,
  camera: { ...camera },
});

export { buildState, cameraPosition };
