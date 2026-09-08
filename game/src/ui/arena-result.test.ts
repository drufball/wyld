// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createArenaResult } from './arena-result.js';
afterEach(() => document.body.replaceChildren());
it('renders the outcome line, learned lines and run count without damage numbers', () => {
  createArenaResult({
    phase: 'win',
    enemyName: 'Antlerback',
    elapsed: 41,
    learned: [
      { kind: 'hide', value: 'Bark' },
      { kind: 'weakness', value: 'Heat' },
    ],
    runCount: 4,
    onPickEnemy: vi.fn(),
    onOpenGuide: vi.fn(),
  });
  expect(document.body.textContent).toContain('Downed the Antlerback in 41 s');
  expect(document.body.textContent).toContain('Hide: Bark');
  expect(document.body.textContent).toContain('Takes heavy damage from Heat');
  expect(document.body.textContent).toContain('Run 4');
  expect(document.body.textContent).not.toMatch(/damage:|\d+ damage/i);
});
