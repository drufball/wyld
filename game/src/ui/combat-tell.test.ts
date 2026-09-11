// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { createCombatTellOverlay } from './combat-tell.js';

afterEach(() => document.body.replaceChildren());

it('places one element per active tell and removes it when it expires', () => {
  const overlay = createCombatTellOverlay();
  overlay.sync([{ id: 1, text: 'Glances off', left: 120, top: 80 }]);
  const element = document.body.querySelector('div');
  expect(element?.textContent).toBe('Glances off');
  expect(element?.style.left).toBe('120px');
  expect(element?.style.top).toBe('80px');
  expect(element?.getAttribute('aria-live')).toBe('polite');
  overlay.sync([]);
  expect(document.body.children).toHaveLength(0);
});

it('combat tell: a second sync with the same tells makes no DOM mutations', () => {
  const overlay = createCombatTellOverlay();
  const tells = [{ id: 1, text: 'Glances off', left: 120, top: 80 }];
  overlay.sync(tells);
  const element = document.body.firstElementChild as HTMLDivElement;
  const observer = new MutationObserver(() => undefined);
  observer.observe(element, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  overlay.sync(tells);
  expect(observer.takeRecords()).toHaveLength(0);
  overlay.sync([{ ...tells[0]!, left: 121 }]);
  expect(observer.takeRecords().some(({ attributeName }) => attributeName === 'style')).toBe(true);
  observer.disconnect();
});
