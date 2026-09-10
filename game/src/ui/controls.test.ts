// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { buildControlRows, createControlsCard, shouldIgnoreArenaKey } from './controls.js';
describe('arena keyboard controls', () => {
  it('ignores the swap key while the console or the guide is open', () => {
    const event = new KeyboardEvent('keydown', { key: 's' });
    expect(shouldIgnoreArenaKey(event, true, false)).toBe(true);
    expect(shouldIgnoreArenaKey(event, false, true)).toBe(true);
    expect(shouldIgnoreArenaKey(event, false, false)).toBe(false);
  });

  it('ignores the swap key while typing in an input', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const inputEvent = new KeyboardEvent('keydown', { key: 's' });
    const textareaEvent = new KeyboardEvent('keydown', { key: 's' });
    const inputGuard = vi.fn((event: KeyboardEvent) => shouldIgnoreArenaKey(event, false, false));
    const textareaGuard = vi.fn((event: KeyboardEvent) =>
      shouldIgnoreArenaKey(event, false, false),
    );
    input.addEventListener('keydown', inputGuard);
    textarea.addEventListener('keydown', textareaGuard);
    input.dispatchEvent(inputEvent);
    textarea.dispatchEvent(textareaEvent);
    expect(inputGuard).toHaveReturnedWith(true);
    expect(textareaGuard).toHaveReturnedWith(true);
  });
});
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
