// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { anchorFor } from './anchors.js';
import { createCombatOverlay, type BarEntry } from './combat-overlay.js';

const target = { x: 5, z: 5 };
const frustum = { halfWidth: 5, halfHeight: 5 };
const rect = { left: 0, top: 0, width: 500, height: 500 };
const entry = (overrides: Partial<BarEntry> = {}): BarEntry => ({
  key: 'one',
  tileX: 5,
  tileY: 5,
  headHeight: 1,
  windup: 0.5,
  ...overrides,
});

describe('createCombatOverlay', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows a bar per combatant and removes it when the fight ends', () => {
    const overlay = createCombatOverlay();
    overlay.sync([entry(), entry({ key: 'two' }), entry({ key: 'three' })], target, frustum, rect);
    expect(document.body.children).toHaveLength(3);
    overlay.sync([], target, frustum, rect);
    expect(document.body.children).toHaveLength(0);
  });

  it('sizes each track to its fraction', () => {
    const overlay = createCombatOverlay();
    overlay.sync([entry({ hp: { value: 5, max: 10 }, windup: 0.25 })], target, frustum, rect);
    const root = document.body.firstElementChild as HTMLDivElement;
    expect((root.children[0]!.firstElementChild as HTMLDivElement).style.width).toBe('17px');
    expect((root.children[2]!.firstElementChild as HTMLDivElement).style.width).toBe('8.5px');
    overlay.dispose();
  });

  it('anchors a bar above the head anchor', () => {
    const overlay = createCombatOverlay();
    overlay.sync([entry()], target, frustum, rect);
    const root = document.body.firstElementChild as HTMLDivElement;
    expect(Number.parseFloat(root.style.top)).toBeLessThan(
      anchorFor(5, 5, 1, target, frustum, rect).top,
    );
    overlay.dispose();
  });

  it('combat overlay: a second sync with the same bars makes no DOM mutations', () => {
    const overlay = createCombatOverlay();
    const bars = [entry({ hp: { value: 5, max: 10 } })];
    overlay.sync(bars, target, frustum, rect);
    const root = document.body.firstElementChild as HTMLDivElement;
    const observer = new MutationObserver(() => undefined);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    overlay.sync(bars, target, frustum, rect);
    expect(observer.takeRecords()).toHaveLength(0);
    overlay.sync([{ ...bars[0]!, tileX: 6 }], target, frustum, rect);
    expect(observer.takeRecords().some(({ attributeName }) => attributeName === 'style')).toBe(
      true,
    );
    observer.disconnect();
  });
});
