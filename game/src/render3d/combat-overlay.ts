import { anchorFor, type AnchorRect } from './anchors.js';

type BarValue = { value: number; max: number };
type BarEntry = {
  key: string;
  tileX: number;
  tileY: number;
  headHeight: number;
  hp?: BarValue;
  focus?: BarValue;
  windup?: number;
};
type Bar = {
  root: HTMLDivElement;
  hp: { track: HTMLDivElement; fill: HTMLDivElement };
  focus: { track: HTMLDivElement; fill: HTMLDivElement };
  windup: { track: HTMLDivElement; fill: HTMLDivElement };
};

const track = (height: number, colour: string) => {
  const root = document.createElement('div');
  root.style.cssText = `width:34px;height:${height}px;background:#292b25`;
  const fill = document.createElement('div');
  fill.style.cssText = `height:100%;background:${colour}`;
  root.append(fill);
  return { track: root, fill };
};
const createBar = (): Bar => {
  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;display:flex;flex-direction:column;gap:1px;transform:translateX(-50%);pointer-events:none;z-index:4';
  const hp = track(3, '#bd7132');
  const focus = track(2, '#4e8292');
  const windup = track(3, '#f4efd9');
  root.append(hp.track, focus.track, windup.track);
  document.body.append(root);
  return { root, hp, focus, windup };
};
const fraction = (value: number, max = 1) => Math.max(0, Math.min(1, max > 0 ? value / max : 0));
const writeStyle = (
  element: HTMLElement,
  property: 'left' | 'top' | 'width' | 'display',
  value: string,
) => {
  if (element.style[property] !== value) element.style[property] = value;
};
const createCombatOverlay = () => {
  const bars = new Map<string, Bar>();
  return {
    sync(
      entries: readonly BarEntry[],
      target: { x: number; z: number },
      frustum: { halfWidth: number; halfHeight: number },
      rect: AnchorRect,
    ) {
      const present = new Set(entries.map(({ key }) => key));
      for (const [key, bar] of bars)
        if (!present.has(key)) {
          bar.root.remove();
          bars.delete(key);
        }
      for (const entry of entries) {
        const bar = bars.get(entry.key) ?? createBar();
        bars.set(entry.key, bar);
        const anchor = anchorFor(entry.tileX, entry.tileY, entry.headHeight, target, frustum, rect);
        writeStyle(bar.root, 'left', `${anchor.left}px`);
        writeStyle(bar.root, 'top', `${anchor.top - 12}px`);
        for (const [element, value] of [
          [bar.hp, entry.hp && fraction(entry.hp.value, entry.hp.max)],
          [bar.focus, entry.focus && fraction(entry.focus.value, entry.focus.max)],
          [bar.windup, entry.windup === undefined ? undefined : fraction(entry.windup)],
        ] as const) {
          writeStyle(element.track, 'display', value === undefined ? 'none' : '');
          if (value !== undefined) writeStyle(element.fill, 'width', `${value * 34}px`);
        }
      }
    },
    dispose() {
      for (const bar of bars.values()) bar.root.remove();
      bars.clear();
    },
  };
};

export { createCombatOverlay };
export type { BarEntry, BarValue };
