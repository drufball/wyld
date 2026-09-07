type WyldGameState = {
  version: string;
  elapsedSeconds: number;
  player: { x: number; y: number; z: number };
  screen: { x: number; y: number };
  tile: { x: number; y: number };
  seed: number;
  region: string | null;
  biome: 'forest' | 'desert' | 'archipelago' | 'volcano' | null;
  phase: 'Dawn' | 'Day' | 'Dusk' | 'Night';
  day: number;
  phaseProgress: number;
  waterDepth: number;
  creatures: {
    id: string;
    species: string;
    temperament: 'Skittish' | 'Bold' | 'Steady' | 'Erratic';
    position: { x: number; y: number; z: number };
    state: 'idle' | 'walk' | 'execute';
    tile: { x: number; y: number };
    region: string | null;
    detection: number;
    behaviour: 'wander' | 'flee' | 'aggro' | 'hold';
  }[];
  party: { id: string; speciesId: string; name: string; tile: { x: number; y: number } }[];
  selection: string;
  target: { id: string; speciesId: string } | null;
  guide: {
    open: boolean;
    tab: string;
    completion: number;
    pages: {
      speciesId: string;
      name: string | null;
      complete: boolean;
      have: number;
      total: number;
    }[];
    stubs: { id: string; speciesId: string; slot: 'tracks' | 'call'; title: string }[];
    fog: { revealed: number; total: number };
    camps: string[];
  };
  observe: { identifying: { species: string | null; progress: number } };
};

interface WyldGameApi {
  getState(): WyldGameState;
  screenshot(): string;
  debug(command: string): string;
  perf(): { fps: number; tileMs: number; drawCalls: number };
  log(): { kind: string; ts: number; payload: unknown }[];
}

declare const __GAME_VERSION__: string;

interface Window {
  __wyld: WyldGameApi;
}
