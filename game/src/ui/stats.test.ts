// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createStatsPanel, percentile } from './stats.js';
describe('percentiles', () => {
  it('finds p50 and p95 by nearest rank', () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    expect([percentile(values, 0.5), percentile(values, 0.95)]).toEqual([10, 19]);
  });
  it('returns zero with no samples', () => expect(percentile([], 0.95)).toBe(0));
});

describe('performance panel', () => {
  it('clears the tools tray and omits tile timing on phones', () => {
    const panel = createStatsPanel(true);
    panel.afterRender(1, 1);
    const phoneRule = [...document.querySelectorAll('style')]
      .map((style) => style.textContent ?? '')
      .find((css) => css.includes('@media(max-width:479px)'))!;
    const bottom = Number(phoneRule.match(/bottom:(\d+)px!important/)?.[1]);

    expect(bottom).toBeGreaterThanOrEqual(60);
    expect(phoneRule).toContain(
      '[data-performance-stat="tile"]{display:none!important}',
    );
    expect(document.querySelector('[data-performance-stat="tile"]')?.textContent).toContain(
      'TILE MS',
    );
    panel.dispose();
  });
});
