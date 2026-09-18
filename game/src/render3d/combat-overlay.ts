import { anchorFor, type AnchorRect } from './anchors.js';
import { healthColour } from '../render2d/combat-bar.js';

type BarValue = { value: number; max: number };
type BarEntry = {
  key: string;
  tileX: number;
  tileY: number;
  widthPx: number;
  heightPx: number;
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

const track = (colour: string) => {
  const root = document.createElement('div');
  root.style.cssText = 'background:#292b25';
  const fill = document.createElement('div');
  fill.style.cssText = `height:100%;background:${colour}`;
  root.append(fill);
  return { track: root, fill };
};
const createBar = (): Bar => {
  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;display:flex;flex-direction:column;gap:1px;transform:translateX(-50%);pointer-events:none;z-index:4';
  const hp = track('#bd7132');
  const focus = track('#4e8292');
  const windup = track('#f4efd9');
  root.append(hp.track, focus.track, windup.track);
  document.body.append(root);
  return { root, hp, focus, windup };
};
const fraction = (value: number, max = 1) => Math.max(0, Math.min(1, max > 0 ? value / max : 0));
const writeStyle = (
  element: HTMLElement,
  property: 'left' | 'top' | 'width' | 'height' | 'display' | 'backgroundColor',
  value: string,
) => {
  if (element.style[property] !== value) element.style[property] = value;
};
const syncTrack = (track: Bar['hp'], value: number | undefined, widthPx: number) => {
  writeStyle(track.track, 'display', value === undefined ? 'none' : '');
  if (value !== undefined) writeStyle(track.fill, 'width', `${value * widthPx}px`);
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
      for (const [key, bar] of bars) {
        let present = false;
        for (const entry of entries)
          if (entry.key === key) {
            present = true;
            break;
          }
        if (!present) {
          bar.root.remove();
          bars.delete(key);
        }
      }
      for (const entry of entries) {
        const bar = bars.get(entry.key) ?? createBar();
        bars.set(entry.key, bar);
        const anchor = anchorFor(entry.tileX, entry.tileY, 0, target, frustum, rect);
        writeStyle(bar.root, 'left', `${anchor.left}px`);
        writeStyle(bar.root, 'top', `${anchor.top + 2}px`);
        const smallHeight = `${Math.max(1, Math.round(entry.heightPx / 2))}px`;
        writeStyle(bar.hp.track, 'width', `${entry.widthPx}px`);
        writeStyle(bar.hp.track, 'height', `${entry.heightPx}px`);
        writeStyle(bar.focus.track, 'width', `${entry.widthPx}px`);
        writeStyle(bar.focus.track, 'height', smallHeight);
        writeStyle(bar.windup.track, 'width', `${entry.widthPx}px`);
        writeStyle(bar.windup.track, 'height', smallHeight);
        if (entry.hp)
          writeStyle(bar.hp.fill, 'backgroundColor', healthColour(entry.hp.value, entry.hp.max));
        syncTrack(bar.hp, entry.hp && fraction(entry.hp.value, entry.hp.max), entry.widthPx);
        syncTrack(
          bar.focus,
          entry.focus && fraction(entry.focus.value, entry.focus.max),
          entry.widthPx,
        );
        syncTrack(
          bar.windup,
          entry.windup === undefined ? undefined : fraction(entry.windup),
          entry.widthPx,
        );
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
