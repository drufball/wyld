// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { createEyeOverlay, type EyeEntry } from './eye-overlay.js';

afterEach(() => document.body.replaceChildren());

it('eye overlay: a second sync with the same eyes makes no DOM mutations', () => {
  const overlay = createEyeOverlay();
  const eyes: EyeEntry[] = [{ key: 'one', tileX: 5, tileY: 5, headHeight: 1, meter: 0.5 }];
  const target = { x: 5, z: 5 };
  const frustum = { halfWidth: 5, halfHeight: 5 };
  const rect = { left: 0, top: 0, width: 500, height: 500 };
  overlay.sync(eyes, target, frustum, rect);
  const root = document.body.firstElementChild as HTMLDivElement;
  const observer = new MutationObserver(() => undefined);
  observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  overlay.sync(eyes, target, frustum, rect);
  expect(observer.takeRecords()).toHaveLength(0);
  overlay.sync([{ ...eyes[0]!, tileX: 6 }], target, frustum, rect);
  expect(observer.takeRecords().some(({ attributeName }) => attributeName === 'style')).toBe(true);
  observer.disconnect();
});
