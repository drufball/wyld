type WyldGameState = {
  version: string;
  elapsedSeconds: number;
  camera: { x: number; y: number; z: number };
  player: { x: number; y: number; z: number };
  seed: number;
  stance: 'walk' | 'sprint' | 'crouch';
  region: string | null;
  biome: 'forest' | 'desert' | 'archipelago' | 'volcano';
  phase: 'Dawn' | 'Day' | 'Dusk' | 'Night';
  day: number;
  phaseProgress: number;
  waterDepth: number;
};

interface WyldGameApi {
  getState(): WyldGameState;
  screenshot(): string;
  debug(command: string): string;
}

declare const __GAME_VERSION__: string;

interface Window {
  __wyld: WyldGameApi;
}
