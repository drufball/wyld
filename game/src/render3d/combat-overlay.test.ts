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
  widthPx: 48,
  heightPx: 6,
  windup: 0.5,
  ...overrides,
});
const styles = (element: Element) => {
  const style = (element as HTMLElement).style;
  return {
    left: style.left,
    top: style.top,
    width: style.width,
    height: style.height,
    display: style.display,
    backgroundColor: style.backgroundColor,
  };
};
const renderedStyles = () =>
  [...document.body.children].map((root) => ({
    root: styles(root),
    tracks: [...root.children].map((trackElement) => ({
      track: styles(trackElement),
      fill: styles(trackElement.firstElementChild!),
    })),
  }));

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
    expect((root.children[0] as HTMLDivElement).style.width).toBe('48px');
    expect((root.children[0] as HTMLDivElement).style.height).toBe('6px');
    expect((root.children[0]!.firstElementChild as HTMLDivElement).style.width).toBe('24px');
    expect((root.children[2]!.firstElementChild as HTMLDivElement).style.width).toBe('12px');
    overlay.dispose();
  });

  it('anchors a bar just below the ground anchor', () => {
    const overlay = createCombatOverlay();
    overlay.sync([entry()], target, frustum, rect);
    const root = document.body.firstElementChild as HTMLDivElement;
    expect(Number.parseFloat(root.style.top)).toBe(
      anchorFor(5, 5, 0, target, frustum, rect).top + 2,
    );
    overlay.dispose();
  });

  it('uses health threshold colours', () => {
    const overlay = createCombatOverlay();
    overlay.sync([entry({ hp: { value: 24, max: 100 } })], target, frustum, rect);
    const fill = document.body.firstElementChild!.children[0]!.firstElementChild as HTMLDivElement;
    expect(fill.style.backgroundColor).toBe('rgb(214, 69, 58)');
    overlay.sync([entry({ hp: { value: 50, max: 100 } })], target, frustum, rect);
    expect(fill.style.backgroundColor).toBe('rgb(111, 191, 63)');
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

  it('writes the same styles as before for a full fight', () => {
    const overlay = createCombatOverlay();
    const entries = [
      entry({
        key: 'one',
        tileX: 4,
        tileY: 4,
        hp: { value: 5, max: 10 },
        focus: { value: 3, max: 4 },
        windup: 0.25,
      }),
      entry({
        key: 'two',
        widthPx: 36,
        heightPx: 5,
        hp: { value: 0, max: 10 },
        focus: { value: 4, max: 4 },
        windup: 1,
      }),
      entry({
        key: 'three',
        tileX: 6,
        tileY: 6,
        widthPx: 24,
        heightPx: 2,
        hp: { value: 12, max: 10 },
        focus: { value: -1, max: 4 },
        windup: -1,
      }),
      entry({ key: 'four', tileX: 7, tileY: 7, widthPx: 12, heightPx: 1 }),
    ];
    const blank = { left: '', top: '', width: '', height: '', display: '', backgroundColor: '' };
    const expected = [
      {
        root: { ...blank, display: 'flex', left: '200px', top: '219.86061951567305px' },
        tracks: [
          {
            track: { ...blank, width: '48px', height: '6px', backgroundColor: 'rgb(41, 43, 37)' },
            fill: { ...blank, width: '24px', height: '100%', backgroundColor: 'rgb(111, 191, 63)' },
          },
          {
            track: { ...blank, width: '48px', height: '3px', backgroundColor: 'rgb(41, 43, 37)' },
            fill: { ...blank, width: '36px', height: '100%', backgroundColor: 'rgb(78, 130, 146)' },
          },
          {
            track: { ...blank, width: '48px', height: '3px', backgroundColor: 'rgb(41, 43, 37)' },
            fill: {
              ...blank,
              width: '12px',
              height: '100%',
              backgroundColor: 'rgb(244, 239, 217)',
            },
          },
        ],
      },
      {
        root: { ...blank, display: 'flex', left: '250px', top: '252px' },
        tracks: [
          {
            track: { ...blank, width: '36px', height: '5px', backgroundColor: 'rgb(41, 43, 37)' },
            fill: { ...blank, width: '0px', height: '100%', backgroundColor: 'rgb(214, 69, 58)' },
          },
          {
            track: { ...blank, width: '36px', height: '3px', backgroundColor: 'rgb(41, 43, 37)' },
            fill: { ...blank, width: '36px', height: '100%', backgroundColor: 'rgb(78, 130, 146)' },
          },
          {
            track: { ...blank, width: '36px', height: '3px', backgroundColor: 'rgb(41, 43, 37)' },
            fill: {
              ...blank,
              width: '36px',
              height: '100%',
              backgroundColor: 'rgb(244, 239, 217)',
            },
          },
        ],
      },
      {
        root: { ...blank, display: 'flex', left: '300px', top: '284.139380484327px' },
        tracks: [
          {
            track: { ...blank, width: '24px', height: '2px', backgroundColor: 'rgb(41, 43, 37)' },
            fill: { ...blank, width: '24px', height: '100%', backgroundColor: 'rgb(111, 191, 63)' },
          },
          {
            track: { ...blank, width: '24px', height: '1px', backgroundColor: 'rgb(41, 43, 37)' },
            fill: { ...blank, width: '0px', height: '100%', backgroundColor: 'rgb(78, 130, 146)' },
          },
          {
            track: { ...blank, width: '24px', height: '1px', backgroundColor: 'rgb(41, 43, 37)' },
            fill: { ...blank, width: '0px', height: '100%', backgroundColor: 'rgb(244, 239, 217)' },
          },
        ],
      },
      {
        root: { ...blank, display: 'flex', left: '350px', top: '316.2787609686539px' },
        tracks: [
          {
            track: {
              ...blank,
              width: '12px',
              height: '1px',
              display: 'none',
              backgroundColor: 'rgb(41, 43, 37)',
            },
            fill: { ...blank, height: '100%', backgroundColor: 'rgb(189, 113, 50)' },
          },
          {
            track: {
              ...blank,
              width: '12px',
              height: '1px',
              display: 'none',
              backgroundColor: 'rgb(41, 43, 37)',
            },
            fill: { ...blank, height: '100%', backgroundColor: 'rgb(78, 130, 146)' },
          },
          {
            track: { ...blank, width: '12px', height: '1px', backgroundColor: 'rgb(41, 43, 37)' },
            fill: { ...blank, width: '6px', height: '100%', backgroundColor: 'rgb(244, 239, 217)' },
          },
        ],
      },
    ];

    overlay.sync(entries, target, frustum, rect);
    expect(renderedStyles()).toEqual(expected);

    overlay.sync(
      entries.map(({ key, tileX, tileY, widthPx, heightPx }) => ({
        key,
        tileX,
        tileY,
        widthPx,
        heightPx,
      })),
      target,
      frustum,
      rect,
    );
    for (const bar of expected) for (const { track } of bar.tracks) track.display = 'none';
    expect(renderedStyles()).toEqual(expected);
    overlay.dispose();
  });

  it('allocates nothing per steady-state sync', () => {
    const overlay = createCombatOverlay();
    const entries = [
      entry(),
      entry({ key: 'two' }),
      entry({ key: 'three' }),
      entry({ key: 'four' }),
    ];
    overlay.sync(entries, target, frustum, rect);
    const NativeSet = globalThis.Set;
    let constructions = 0;
    class CountingSet<T> extends NativeSet<T> {
      constructor(values?: readonly T[] | null) {
        super(values);
        constructions += 1;
      }
    }
    try {
      globalThis.Set = CountingSet as SetConstructor;
      overlay.sync(entries, target, frustum, rect);
      expect(constructions).toBe(0);
    } finally {
      globalThis.Set = NativeSet;
      overlay.dispose();
    }
  });
});
