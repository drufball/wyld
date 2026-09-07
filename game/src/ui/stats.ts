type PerformanceStats = { fps: number; tileMs: number; drawCalls: number };
const createStatsPanel = (available: boolean) => {
  let stats: PerformanceStats = { fps: 0, tileMs: 0, drawCalls: 0 },
    frames = 0,
    start = performance.now(),
    panel: HTMLDivElement | undefined;
  if (available) {
    panel = document.createElement('div');
    panel.setAttribute('aria-label', 'Performance statistics');
    panel.style.cssText =
      'position:fixed;z-index:5;right:14px;top:14px;min-width:132px;padding:9px 12px;background:#f5f0dce8;border:1px solid #55584b;color:#25291f;font:12px/22px ui-monospace,monospace;white-space:pre';
    document.body.append(panel);
    const responsive = document.createElement('style');
    responsive.textContent =
      '@media(max-width:479px){[aria-label="Performance statistics"]{top:auto!important;right:8px!important;bottom:8px!important;min-width:112px!important;padding:6px 8px!important;font-size:10px!important;line-height:16px!important}}';
    document.head.append(responsive);
  }
  return {
    afterRender(tileMs: number, drawCalls: number, now = performance.now()) {
      frames++;
      stats = { ...stats, tileMs, drawCalls };
      if (now - start >= 1000) {
        stats.fps = (frames * 1000) / (now - start);
        frames = 0;
        start = now;
      }
      if (panel)
        panel.textContent = `FPS        ${stats.fps.toFixed(1)}\nTILE MS    ${stats.tileMs.toFixed(1)}\nDRAW CALLS ${stats.drawCalls}`;
    },
    read: () => ({ ...stats }),
    dispose: () => panel?.remove(),
  };
};
export { createStatsPanel };
export type { PerformanceStats };
