type WyldGameState = {
  version: string;
  elapsedSeconds: number;
  camera: { x: number; y: number; z: number };
};

interface WyldGameApi {
  getState(): WyldGameState;
  screenshot(): string;
}

declare const __GAME_VERSION__: string;

interface Window {
  __wyld: WyldGameApi;
}
