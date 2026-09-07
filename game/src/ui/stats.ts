import type * as THREE from 'three';

type PerformanceStats = { fps: number; triangles: number; drawCalls: number };
type StatsPanel = {
  afterRender(renderer: THREE.WebGLRenderer, now?: number): void;
  read(): PerformanceStats;
  dispose(): void;
};

const createStatsPanel = (available: boolean): StatsPanel => {
  let stats: PerformanceStats = { fps: 0, triangles: 0, drawCalls: 0 };
  let frameCount = 0;
  let intervalStart = performance.now();
  let panel: HTMLDivElement | undefined;
  if (available) {
    panel = document.createElement('div');
    panel.setAttribute('aria-label', 'Performance statistics');
    panel.style.cssText =
      'position:fixed;z-index:5;right:14px;top:14px;min-width:132px;padding:9px 12px;background:repeating-linear-gradient(#f5f0dce8 0,#f5f0dce8 21px,#c9c1a4e8 22px);border:1px solid #55584b;color:#25291f;box-shadow:2px 3px 10px #0005;font:12px/22px ui-monospace,monospace;white-space:pre';
    document.body.append(panel);
  }
  const afterRender = (renderer: THREE.WebGLRenderer, now = performance.now()): void => {
    if (!available) return;
    frameCount += 1;
    stats = {
      ...stats,
      triangles: renderer.info.render.triangles,
      drawCalls: renderer.info.render.calls,
    };
    const duration = now - intervalStart;
    if (duration >= 1000) {
      stats.fps = (frameCount * 1000) / duration;
      frameCount = 0;
      intervalStart = now;
    }
    if (panel)
      panel.textContent = `FPS       ${stats.fps.toFixed(1)}\nTRIANGLES ${stats.triangles.toLocaleString()}\nDRAW CALLS ${stats.drawCalls}`;
  };
  return { afterRender, read: () => ({ ...stats }), dispose: () => panel?.remove() };
};

export { createStatsPanel };
export type { PerformanceStats, StatsPanel };
