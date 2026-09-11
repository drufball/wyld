import { anchorFor, type AnchorRect } from './anchors.js';

type EyeEntry = { key: string; tileX: number; tileY: number; headHeight: number; meter: number };
const createEye = (): { root: HTMLDivElement; fill: HTMLDivElement } => {
  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;width:22px;height:16px;transform:translateX(-50%);pointer-events:none;z-index:4;background:#292b25;border-radius:70% 20%;rotate:45deg;overflow:hidden;box-shadow:0 0 0 1px #f5f0dc99';
  const fill = document.createElement('div');
  fill.style.cssText =
    'height:6px;position:absolute;left:3px;top:5px;background:#d8d1ae;rotate:-45deg;transform-origin:left center';
  root.append(fill);
  document.body.append(root);
  return { root, fill };
};
const createEyeOverlay = () => {
  const eyes = new Map<string, ReturnType<typeof createEye>>();
  return {
    sync(
      entries: readonly EyeEntry[],
      target: { x: number; z: number },
      frustum: { halfWidth: number; halfHeight: number },
      rect: AnchorRect,
    ) {
      const visible = new Set(entries.filter(({ meter }) => meter > 0).map(({ key }) => key));
      for (const [key, eye] of eyes)
        if (!visible.has(key)) {
          eye.root.remove();
          eyes.delete(key);
        }
      for (const entry of entries) {
        if (entry.meter <= 0) continue;
        const eye = eyes.get(entry.key) ?? createEye();
        eyes.set(entry.key, eye);
        const anchor = anchorFor(entry.tileX, entry.tileY, entry.headHeight, target, frustum, rect);
        const left = `${anchor.left}px`;
        const top = `${anchor.top - 10}px`;
        const width = `${Math.max(0, Math.min(1, entry.meter)) * 16}px`;
        if (eye.root.style.left !== left) eye.root.style.left = left;
        if (eye.root.style.top !== top) eye.root.style.top = top;
        if (eye.fill.style.width !== width) eye.fill.style.width = width;
      }
    },
    dispose() {
      for (const eye of eyes.values()) eye.root.remove();
      eyes.clear();
    },
  };
};
export { createEyeOverlay };
export type { EyeEntry };
