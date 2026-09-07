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
  creatures: {
    id: string;
    species: string;
    temperament: 'Skittish' | 'Bold' | 'Steady' | 'Erratic';
    position: { x: number; y: number; z: number };
    state: 'idle' | 'locomotion' | 'execute';
    region: string | null;
    detection: number;
    behaviour: 'wander' | 'flee' | 'aggro' | 'hold';
  }[];
  guide: {
    completion: number;
    pages: {
      speciesId: string;
      name: string | null;
      complete: boolean;
      have: number;
      total: number;
    }[];
    stubs: { id: string; speciesId: string; slot: 'tracks' | 'call'; title: string }[];
  };
  observe: { identifying: { species: string | null; progress: number } };
};

interface WyldGameApi {
  getState(): WyldGameState;
  screenshot(): string;
  debug(command: string): string;
  perf(): { fps: number; triangles: number; drawCalls: number };
  log(): { kind: string; ts: number; payload: unknown }[];
}

declare const __GAME_VERSION__: string;

interface Window {
  __wyld: WyldGameApi;
}
