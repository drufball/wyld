type PerformanceStats = {
  fps: number;
  tileMs: number;
  drawCalls: number;
  frameMsP50: number;
  frameMsP95: number;
  samples: number;
};
const percentile = (values: readonly number[], percent: number): number =>
  values.length
    ? [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * percent) - 1)]!
    : 0;
const createStatsPanel = (available: boolean) => {
  let stats: PerformanceStats = {
      fps: 0,
      tileMs: 0,
      drawCalls: 0,
      frameMsP50: 0,
      frameMsP95: 0,
      samples: 0,
    },
    frames = 0,
    start = performance.now(),
    panel: HTMLDivElement | undefined,
    previousFrame: number | undefined;
  const intervals: number[] = [];
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
      if (previousFrame !== undefined) {
        intervals.push(now - previousFrame);
        if (intervals.length > 240) intervals.shift();
      }
      previousFrame = now;
      stats = {
        ...stats,
        tileMs,
        drawCalls,
        frameMsP50: percentile(intervals, 0.5),
        frameMsP95: percentile(intervals, 0.95),
        samples: intervals.length,
      };
      if (now - start >= 1000) {
        stats.fps = (frames * 1000) / (now - start);
        frames = 0;
        start = now;
      }
      if (panel)
        panel.textContent = `FPS        ${stats.fps.toFixed(1)}\nTILE MS    ${stats.tileMs.toFixed(1)}\nP95 MS     ${stats.frameMsP95.toFixed(1)}\nDRAW CALLS ${stats.drawCalls}`;
    },
    read: () => ({ ...stats }),
    dispose: () => panel?.remove(),
  };
};
export { createStatsPanel, percentile };
export type { PerformanceStats };
