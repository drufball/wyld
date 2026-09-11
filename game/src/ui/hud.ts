import type { TimeState } from '../world/time.js';
import type { Individual } from '../creatures/individual.js';
import type { CombatState } from '../combat/encounter.js';
import { deliveries } from '../combat/resolve.js';
import { shrugsOffLine } from '../combat/hides.js';
import { speciesById } from '../creatures/species.js';

type HudState = TimeState & {
  regionName: string | null;
  biome: string | null;
  target?: { detection: number } | null;
  party?: { individual: Individual; name: string }[];
  selection?: string;
  combat?: CombatState | null;
  autopilotMoveId?: string | null;
  autopilotYielding?: boolean;
  notice?: { id: string; text: string; refused: boolean } | null;
};
type HudActions = {
  selectCreature?(id: string): void;
  useMove?(moveId: string): void;
  swapIn?(reserveId: string): void;
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
const createHud = (
  showRegion: boolean,
  toastRoot: HTMLElement,
  actions: HudActions = {},
  { showMap = true }: { showMap?: boolean } = {},
) => {
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
    '@keyframes wyld-swap-pulse{from{box-shadow:0 0 0 0 #bd7132}to{box-shadow:0 0 0 8px #bd713200}}[data-swap-state="urgent"]{animation:wyld-swap-pulse .8s infinite}[data-swap-state="ready"]{font-weight:700;box-shadow:0 0 0 2px #bd7132,0 0 10px #bd7132aa}@media(prefers-reduced-motion:reduce){[data-swap-state="urgent"]{animation:none;box-shadow:0 0 0 2px #bd7132,0 0 10px #bd7132aa}}@media(max-width:479px){[aria-label="Time and place"]{top:8px!important;left:8px!important;width:134px!important;padding:7px 9px!important;font-size:10px!important;line-height:16px!important}[data-hud-heading]{gap:6px!important;font-size:13px!important}[data-hud-heading] svg{width:32px;height:18px}[aria-label="Time and place"] div:nth-child(3){margin-top:3px!important;font-size:9px!important}}';
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
    'position:fixed;z-index:5;left:8px;right:8px;bottom:8px;display:flex;flex-direction:column;gap:4px;pointer-events:auto;font:11px/14px ui-monospace,monospace';
  const partyCards = document.createElement('div');
  partyCards.dataset.trayRow = 'party';
  partyCards.style.cssText = 'display:flex;flex:1;min-width:0;gap:4px;align-items:end';
  const moves = document.createElement('div');
  moves.dataset.trayRow = 'moves';
  moves.style.cssText = 'display:flex;width:100%;gap:4px;justify-content:center';
  const tools = document.createElement('div');
  tools.dataset.trayRow = 'tools';
  tools.style.cssText = 'display:flex;gap:4px;justify-content:flex-end';
  const partyAndTools = document.createElement('div');
  partyAndTools.style.cssText = 'display:flex;min-width:0;gap:4px;align-items:end';
  const control = (label: string, action?: () => void): HTMLButtonElement => {
    const button = document.createElement('button');
    button.textContent = label;
    button.style.cssText =
      'box-sizing:border-box;min-width:44px;height:44px;padding:4px;border:1px solid #777566;background:#f4efd9ee;color:#292b25;font:inherit;cursor:pointer';
    // Set touch-target dimensions separately because older CSSOM implementations reject
    // the entire declaration block when they cannot parse the translucent paper color.
    button.style.minWidth = '44px';
    button.style.height = '44px';
    if (action) button.addEventListener('click', action);
    return button;
  };
  const tool = (icon: string, label: string, action: () => void) => {
    const button = control(icon, action);
    button.setAttribute('aria-label', label);
    button.title = label;
    return button;
  };
  tools.append(tool('\u25a4', 'Book', () => actions.openBook?.()));
  if (showMap) tools.append(tool('\u2316', 'Map', () => actions.openMap?.()));
  if (showRegion) tools.append(tool('>_', 'Console', () => actions.openConsole?.()));
  partyAndTools.append(partyCards, tools);
  tray.append(moves, partyAndTools);
  document.body.append(tray);
  const trayLabel = (text: string): HTMLSpanElement => {
    const label = document.createElement('span');
    label.dataset.trayLabel = '';
    label.textContent = text;
    label.style.cssText =
      'flex:0 0 auto;writing-mode:vertical-rl;transform:rotate(180deg);font-size:9px;text-transform:uppercase;color:#f4efd9;pointer-events:none';
    return label;
  };
  const applyNotice = (button: HTMLButtonElement, id: string, notice: HudState['notice']): void => {
    if (!notice || notice.id !== id) return;
    button.dataset.notice = notice.text;
    const detail = document.createElement('small');
    detail.dataset.noticeText = '';
    detail.textContent = notice.text;
    detail.style.cssText = 'display:block;font-size:9px;line-height:10px';
    button.querySelector('small')?.remove();
    button.append(detail);
    if (notice.refused) {
      button.dataset.refused = '';
      button.style.outline = '3px dashed #b3261e';
    }
  };
  return {
    update(state: HudState): void {
      phase.textContent = state.phase;
      progress.style.strokeDasharray = `${state.phaseProgress} 1`;
      day.textContent = `Day ${state.day}`;
      region.textContent = state.biome
        ? `${state.regionName ?? 'Uncharted'} · ${state.biome}`
        : (state.regionName ?? '');
      region.hidden = !state.regionName && !state.biome;
      updateDetectionTarget({ bar: targetBar, fill: eyeFill, outline: eyeOutline }, state.target);
      partyCards.replaceChildren(
        trayLabel('Yours'),
        ...(state.party ?? []).map(({ individual, name }) => {
          const combatant = state.combat?.party.find((c) => c.id === individual.id);
          const standingReserve = Boolean(combatant?.benched && !combatant.downed);
          const button = control(
            standingReserve
              ? `Tap to bring ${name} in`
              : `${name}\n${combatant?.downed ? 'Down' : individual.temperament}`,
            standingReserve
              ? () => actions.swapIn?.(individual.id)
              : () => actions.selectCreature?.(individual.id),
          );
          button.title = individual.speciesId;
          button.style.flex = '1 1 0';
          button.style.minWidth = '0';
          if (standingReserve) button.style.minWidth = '44px';
          button.setAttribute('aria-pressed', String(state.selection === individual.id));
          button.dataset.partyId = individual.id;
          if (state.selection === individual.id) button.style.outline = '2px solid #bd7132';
          if (combatant?.benched && combatant.downed) button.style.opacity = '0.45';
          if (standingReserve) {
            button.dataset.reserve = '';
            const urgent =
              state.combat!.autoDeployIn !== null ||
              state.combat!.party.some((c) => !c.benched && c.downed);
            const swapState = urgent
              ? 'urgent'
              : state.combat!.swapCooldown.remaining === 0
                ? 'ready'
                : 'cooldown';
            button.dataset.swapState = swapState;
            const detail = document.createElement('small');
            detail.textContent =
              state.combat!.autoDeployIn !== null
                ? `Coming in… ${Math.ceil(state.combat!.autoDeployIn)}`
                : `${individual.temperament} · ${shrugsOffLine(speciesById(individual.speciesId)!.hide)}`;
            detail.style.cssText = 'display:block;font-size:9px;line-height:10px';
            button.append(detail);
            if (swapState === 'cooldown') {
              button.firstChild!.textContent += ` ◷${Math.ceil(state.combat!.swapCooldown.remaining)}`;
              button.style.background = `linear-gradient(to top,#aaa ${(state.combat!.swapCooldown.remaining / state.combat!.swapCooldown.total) * 100}%,#f4efd9ee 0)`;
            }
          }
          if (combatant) {
            const bars = document.createElement('span');
            bars.style.cssText = 'display:block;width:52px;height:5px;background:#292b25';
            bars.innerHTML = `<i style="display:block;width:${(combatant.hp / combatant.maxHp) * 100}%;height:2px;background:#bd7132"></i><i style="display:block;width:${(combatant.focus / combatant.maxFocus) * 100}%;height:2px;background:#4e8292"></i>`;
            button.append(bars);
          }
          applyNotice(button, individual.id, state.notice);
          return button;
        }),
      );
      moves.replaceChildren(trayLabel('Moves'));
      const selected = state.party?.find(({ individual }) => individual.id === state.selection);
      for (const move of selected?.individual.repertoire ?? []) {
        const combatant = state.combat?.party.find((c) => c.id === selected?.individual.id);
        const cooldown = combatant?.cooldowns[move.id];
        const cost = deliveries[move.delivery].focus;
        const armed = state.autopilotMoveId === move.id;
        const button = control(
          `${move.name}${armed ? ' ↻' : ''}${cooldown?.remaining ? ` ◷${Math.ceil(cooldown.remaining)}` : ''}`,
        );
        button.dataset.moveId = move.id;
        button.style.flex = '1 1 0';
        button.style.minWidth = '0';
        const unavailable = Boolean(
          combatant && (combatant.focus < cost || (cooldown?.remaining ?? 0) > 0),
        );
        button.disabled = !state.combat && unavailable;
        button.style.opacity = unavailable ? '0.45' : '1';
        button.setAttribute('aria-pressed', String(armed));
        if (armed) {
          button.dataset.autopilot = state.autopilotYielding ? 'yielding' : 'holding';
          button.style.outline = state.autopilotYielding
            ? '2px dashed #bd7132'
            : '2px solid #bd7132';
        }
        applyNotice(button, move.id, state.notice);
        button.style.background = cooldown?.remaining
          ? `linear-gradient(to top,#aaa ${(cooldown.remaining / cooldown.total) * 100}%,#f4efd9ee 0)`
          : '#f4efd9ee';
        button.addEventListener('click', () => actions.useMove?.(move.id));
        moves.append(button);
      }
    },
    targetBar,
    tray,
  };
};

export { createHud, updateDetectionTarget };
export type { DetectionTargetElements, HudActions, HudState };
