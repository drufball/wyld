import type { TimeState } from '../world/time.js';

type HudState = TimeState & { regionName: string | null; biome: string };
const createHud = (showRegion: boolean) => {
  const root = document.createElement('aside');
  root.setAttribute('aria-live', 'polite');
  root.style.cssText =
    'position:fixed;z-index:4;top:16px;left:16px;width:190px;padding:13px 15px;color:#292b25;border:1px solid #777566;background:repeating-linear-gradient(0deg,#f4efd9ee 0,#f4efd9ee 21px,#cbc4a777 22px),linear-gradient(105deg,#fff9df,#e8dfc5);box-shadow:1px 2px 2px #0005;font:13px/22px ui-monospace,monospace;pointer-events:none';
  const heading = document.createElement('div');
  heading.style.cssText = 'display:flex;align-items:center;gap:10px;font-size:17px;font-weight:700';
  const phase = document.createElement('span');
  const arc = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arc.setAttribute('viewBox', '0 0 42 24');
  arc.setAttribute('width', '42');
  arc.setAttribute('height', '24');
  arc.innerHTML =
    '<path d="M3 21 A18 18 0 0 1 39 21" fill="none" stroke="#aaa58f" stroke-width="2"/><path d="M3 21 A18 18 0 0 1 39 21" fill="none" stroke="#30352d" stroke-width="2" pathLength="1"/>';
  const progress = arc.lastElementChild as SVGPathElement;
  const day = document.createElement('div');
  const region = document.createElement('div');
  region.style.cssText = 'margin-top:5px;border-top:1px solid #8d8978;font-size:11px';
  heading.append(phase, arc);
  root.append(heading, day);
  if (showRegion) root.append(region);
  document.body.append(root);
  return {
    update(state: HudState): void {
      phase.textContent = state.phase;
      progress.style.strokeDasharray = `${state.phaseProgress} 1`;
      day.textContent = `Day ${state.day}`;
      region.textContent = `${state.regionName ?? 'Uncharted'} · ${state.biome}`;
    },
  };
};

export { createHud };
export type { HudState };
