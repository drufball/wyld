type PerformanceStats = { fps: number; tileMs: number; drawCalls: number };
const createStatsPanel = (available: boolean) => {
  let stats: PerformanceStats = { fps: 0, tileMs: 0, drawCalls: 0 },
    frames = 0,
    start = performance.now();
  return {
    afterRender(tileMs: number, drawCalls: number, now = performance.now()) {
      frames++;
      stats = { ...stats, tileMs, drawCalls };
      if (now - start >= 1000) {
        stats.fps = (frames * 1000) / (now - start);
        frames = 0;
        start = now;
      }
    },
    read: () => ({ ...stats }),
    dispose() {
      void available;
    },
  };
};
export { createStatsPanel };
export type { PerformanceStats };
