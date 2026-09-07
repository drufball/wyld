// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { buildControlRows, createControlsCard } from './controls.js';
describe('controls card rows', () => {
  it('lists tap controls and gates the console', () => {
    expect(buildControlRows(false).map(([key]) => key)).toEqual([
      'Tap the ground',
      'Tap a creature',
      'Tap yourself',
      'Tap a wild creature',
      'Walk to an edge',
      '?',
    ]);
    expect(buildControlRows(true).at(-1)).toEqual(['`', 'console']);
  });
});
describe('controls card', () => {
  it('sits above the thumb HUD and dismisses when tapped', () => {
    vi.useFakeTimers();
    const card = createControlsCard(false, () => false);
    expect(card.root.style.bottom).toBe('64px');
    card.root.click();
    expect(card.root.style.opacity).toBe('0');
    card.dispose();
    vi.useRealTimers();
  });
});
