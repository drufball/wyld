import type { TimeState } from '../world/time.js';
import type { Individual } from '../creatures/individual.js';

type HudState = TimeState & {
  regionName: string | null;
  biome: string;
  target?: { detection: number } | null;
  party?: { individual: Individual; name: string }[];
  selection?: string;
};
type HudActions = {
  selectCreature?(id: string): void;
  openBook?(): void;
  openMap?(): void;
  openConsole?(): void;
};
type DetectionTargetElements = {
  bar: { style: { display: string } };
  fill: { setAttribute(name: string, value: string): void };
  outline: { setAttribute(name: string, value: string): void };
};
const updateDetectionTarget = (
  elements: DetectionTargetElements,
  target?: { detection: number } | null,
): void => {
  const detection = Math.max(0, Math.min(1, target?.detection ?? 0));
  elements.bar.style.display = target && detection > 0 ? 'flex' : 'none';
  elements.fill.setAttribute('width', String(38 * detection));
  elements.fill.setAttribute('data-detection-fill', detection.toFixed(3));
  elements.outline.setAttribute('stroke', detection >= 1 ? '#292b25' : '#777566');
};
const createHud = (showRegion: boolean, toastRoot: HTMLElement, actions: HudActions = {}) => {
  const root = document.createElement('aside');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-label', 'Time and place');
  root.style.cssText =
    'position:fixed;z-index:4;top:16px;left:16px;width:190px;padding:13px 15px;color:#292b25;border:1px solid #777566;background:repeating-linear-gradient(0deg,#f4efd9ee 0,#f4efd9ee 21px,#cbc4a777 22px),linear-gradient(105deg,#fff9df,#e8dfc5);box-shadow:1px 2px 2px #0005;font:13px/22px ui-monospace,monospace;pointer-events:none';
  const heading = document.createElement('div');
  heading.setAttribute('data-hud-heading', '');
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
  const responsive = document.createElement('style');
  responsive.textContent =
    '@media(max-width:479px){[aria-label="Time and place"]{top:8px!important;left:8px!important;width:134px!important;padding:7px 9px!important;font-size:10px!important;line-height:16px!important}[data-hud-heading]{gap:6px!important;font-size:13px!important}[data-hud-heading] svg{width:32px;height:18px}[aria-label="Time and place"] div:nth-child(3){margin-top:3px!important;font-size:9px!important}}';
  document.head.append(responsive);
  const controlsHint = document.createElement('div');
  controlsHint.textContent = '? — controls';
  controlsHint.style.cssText =
    'position:fixed;right:12px;bottom:10px;color:#f4efd9;font:12px ui-monospace,monospace;text-shadow:1px 1px #292b25';
  root.append(controlsHint);
  const targetBar = document.createElement('aside');
  targetBar.setAttribute('aria-label', 'Creature detection');
  targetBar.style.cssText =
    'align-self:center;display:none;align-items:center;gap:12px;min-width:190px;padding:7px 12px;color:#292b25;border:1px solid #777566;background:#f4efd9ee;box-shadow:1px 2px 2px #0004;font:13px/20px ui-monospace,monospace;pointer-events:none';
  const targetLabel = document.createElement('span');
  targetLabel.textContent = 'Unknown creature';
  const eye = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  eye.setAttribute('viewBox', '0 0 42 24');
  eye.setAttribute('width', '42');
  eye.setAttribute('height', '24');
  eye.setAttribute('aria-hidden', 'true');
  const clipId = 'wyld-detection-eye-clip';
  eye.innerHTML = `<defs><clipPath id="${clipId}"><path d="M2 12 Q11 2 21 2 Q31 2 40 12 Q31 22 21 22 Q11 22 2 12Z"/></clipPath></defs><rect data-detection-fill x="2" y="2" width="0" height="20" fill="#292b25" clip-path="url(#${clipId})"/><path d="M2 12 Q11 2 21 2 Q31 2 40 12 Q31 22 21 22 Q11 22 2 12Z" fill="none" stroke="#777566" stroke-width="1.5"/><circle cx="21" cy="12" r="3" fill="#292b25"/>`;
  const eyeFill = eye.querySelector('[data-detection-fill]') as SVGRectElement;
  const eyeOutline = eye.lastElementChild?.previousElementSibling as SVGPathElement;
  targetBar.append(targetLabel, eye);
  toastRoot.append(targetBar);
  const tray = document.createElement('nav');
  tray.setAttribute('aria-label', 'Party and tools');
  tray.style.cssText =
    'position:fixed;z-index:5;left:8px;right:8px;bottom:8px;display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:8px;pointer-events:auto;font:11px/14px ui-monospace,monospace';
  const partyCards = document.createElement('div');
  partyCards.style.cssText = 'display:flex;gap:4px;align-items:end';
  const moves = document.createElement('div');
  moves.style.cssText = 'display:flex;gap:4px;justify-content:center';
  const tools = document.createElement('div');
  tools.style.cssText = 'display:flex;gap:4px;justify-content:flex-end';
  const control = (label: string, action?: () => void): HTMLButtonElement => {
    const button = document.createElement('button');
    button.textContent = label;
    button.style.cssText =
      'box-sizing:border-box;min-width:44px;min-height:44px;padding:4px;border:1px solid #777566;background:#f4efd9ee;color:#292b25;font:inherit;cursor:pointer';
    if (action) button.addEventListener('click', action);
    return button;
  };
  tools.append(
    control('Book', () => actions.openBook?.()),
    control('Map', () => actions.openMap?.()),
  );
  if (showRegion) tools.append(control('Console', () => actions.openConsole?.()));
  tray.append(partyCards, moves, tools);
  document.body.append(tray);
  return {
    update(state: HudState): void {
      phase.textContent = state.phase;
      progress.style.strokeDasharray = `${state.phaseProgress} 1`;
      day.textContent = `Day ${state.day}`;
      region.textContent = `${state.regionName ?? 'Uncharted'} · ${state.biome}`;
      updateDetectionTarget({ bar: targetBar, fill: eyeFill, outline: eyeOutline }, state.target);
      partyCards.replaceChildren(
        ...(state.party ?? []).map(({ individual, name }) => {
          const button = control(`${name}\n${individual.speciesId}`, () =>
            actions.selectCreature?.(individual.id),
          );
          button.setAttribute('aria-pressed', String(state.selection === individual.id));
          button.dataset.partyId = individual.id;
          if (state.selection === individual.id) button.style.outline = '2px solid #bd7132';
          return button;
        }),
      );
      moves.replaceChildren();
      const selected = state.party?.find(({ individual }) => individual.id === state.selection);
      for (const move of selected?.individual.repertoire ?? []) {
        const button = control(move.name);
        button.dataset.moveId = move.id;
        button.addEventListener('click', () => (button.textContent = 'Not yet.'));
        moves.append(button);
      }
    },
    targetBar,
    tray,
  };
};

export { createHud, updateDetectionTarget };
export type { DetectionTargetElements, HudActions, HudState };
