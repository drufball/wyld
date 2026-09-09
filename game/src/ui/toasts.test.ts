// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { learnedFactText } from '../arena/learning.js';
import { createToastStack } from './toasts.js';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it('toasts the hide by name and nothing else when it is learned', () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
  const toasts = createToastStack();
  toasts.note(learnedFactText({ kind: 'hide', value: 'Bark' }));
  const toast = toasts.root.querySelector('section');
  expect(toast?.textContent).toBe('Hide: Bark');
  expect(toast?.children).toHaveLength(1);
});
