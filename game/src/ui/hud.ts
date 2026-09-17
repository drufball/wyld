import type { TimeState } from '../world/time.js';
import type { Individual } from '../creatures/individual.js';
import type { CombatState } from '../combat/encounter.js';
import { deliveries } from '../combat/resolve.js';

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
  const yoursLabel = trayLabel('Yours');
  const movesLabel = trayLabel('Moves');
  type CachedControl = {
    button: HTMLButtonElement;
    label: Text;
    detail: HTMLElement;
    bars: HTMLSpanElement;
    hp: HTMLElement;
    focus: HTMLElement;
    action: () => void;
  };
  const partyControls = new Map<string, CachedControl>();
  const moveControls = new Map<string, CachedControl>();
  let partyOrder: string | null = null;
  let moveOrder: string | null = null;
  const write = <K extends keyof CSSStyleDeclaration>(
    style: CSSStyleDeclaration,
    property: K,
    value: CSSStyleDeclaration[K],
  ): void => {
    if (style[property] !== value) style[property] = value;
  };
  const text = (node: Node, value: string): void => {
    if (node.textContent !== value) node.textContent = value;
  };
  const property = <T extends object, K extends keyof T>(target: T, key: K, value: T[K]): void => {
    if (target[key] !== value) target[key] = value;
  };
  const attribute = (element: Element, name: string, value?: string): void => {
    if (value === undefined) {
      if (element.hasAttribute(name)) element.removeAttribute(name);
    } else if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  };
  const cachedControl = (action: () => void): CachedControl => {
    const button = control('');
    const label = document.createTextNode('');
    const detail = document.createElement('small');
    detail.style.cssText = 'display:block;font-size:9px;line-height:10px';
    const bars = document.createElement('span');
    bars.style.cssText = 'display:block;width:52px;height:5px;background:#292b25';
    const hp = document.createElement('i');
    hp.style.cssText = 'display:block;width:0%;height:2px;background:#bd7132';
    const focus = document.createElement('i');
    focus.style.cssText = 'display:block;width:0%;height:2px;background:#4e8292';
    bars.append(hp, focus);
    button.replaceChildren(label);
    const entry = { button, label, detail, bars, hp, focus, action };
    button.addEventListener('click', () => entry.action());
    return entry;
  };
  const applyNotice = (entry: CachedControl, id: string, notice: HudState['notice']): boolean => {
    const active = notice?.id === id;
    attribute(entry.button, 'data-notice', active ? notice.text : undefined);
    attribute(entry.button, 'data-refused', active && notice.refused ? '' : undefined);
    attribute(entry.detail, 'data-notice-text', active ? '' : undefined);
    if (active) text(entry.detail, notice.text);
    return active;
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
      const partyKeys = (state.party ?? []).map(({ individual }) => individual.id);
      for (const key of partyControls.keys())
        if (!partyKeys.includes(key)) partyControls.delete(key);
      for (const { individual, name } of state.party ?? []) {
        const combatant = state.combat?.party.find((c) => c.id === individual.id);
        const standingReserve = Boolean(combatant?.benched && !combatant.downed);
        let entry = partyControls.get(individual.id);
        if (!entry) {
          entry = cachedControl(() => undefined);
          partyControls.set(individual.id, entry);
        }
        entry.action = standingReserve
          ? () => actions.swapIn?.(individual.id)
          : combatant?.downed
            ? () => undefined
            : () => actions.selectCreature?.(individual.id);
        const button = entry.button;
        const label = standingReserve
          ? name
          : `${name}\n${combatant?.downed ? 'Down' : individual.temperament}`;
        property(button, 'title', individual.speciesId);
        write(button.style, 'flex', standingReserve ? '1 1 0px' : '2 1 0px');
        write(button.style, 'minWidth', standingReserve ? '44px' : '0px');
        attribute(button, 'aria-pressed', String(state.selection === individual.id));
        attribute(button, 'data-party-id', individual.id);
        write(
          button.style,
          'outline',
          state.selection === individual.id ? '2px solid #bd7132' : '',
        );
        write(button.style, 'opacity', combatant?.benched && combatant.downed ? '0.45' : '');
        attribute(button, 'data-reserve', standingReserve ? '' : undefined);
        attribute(button, 'data-swap-state');
        write(button.style, 'background', '#f4efd9ee');
        let detail: string | undefined;
        if (standingReserve) {
          const urgent =
            state.combat!.autoDeployIn !== null ||
            state.combat!.party.some((c) => !c.benched && c.downed);
          const swapState = urgent
            ? 'urgent'
            : state.combat!.swapCooldown.remaining === 0
              ? 'ready'
              : 'cooldown';
          attribute(button, 'data-swap-state', swapState);
          detail =
            state.combat!.autoDeployIn !== null
              ? `Coming in… ${Math.ceil(state.combat!.autoDeployIn)}`
              : swapState === 'cooldown'
                ? `◷${Math.ceil(state.combat!.swapCooldown.remaining)}`
                : 'reserve · tap to swap';
          if (swapState === 'cooldown') {
            write(
              button.style,
              'background',
              `linear-gradient(to top,#aaa ${(state.combat!.swapCooldown.remaining / state.combat!.swapCooldown.total) * 100}%,#f4efd9ee 0)`,
            );
          }
        }
        if (combatant) {
          write(entry.hp.style, 'width', `${(combatant.hp / combatant.maxHp) * 100}%`);
          write(entry.focus.style, 'width', `${(combatant.focus / combatant.maxFocus) * 100}%`);
        }
        const notice = applyNotice(entry, individual.id, state.notice);
        text(entry.label, label);
        if (notice) detail = state.notice!.text;
        if (detail !== undefined) text(entry.detail, detail);
        const children: Node[] = [entry.label];
        if (detail !== undefined && !notice) children.push(entry.detail);
        if (combatant) children.push(entry.bars);
        if (notice) children.push(entry.detail);
        if (
          children.some((child, index) => button.childNodes[index] !== child) ||
          button.childNodes.length !== children.length
        )
          button.replaceChildren(...children);
        write(
          button.style,
          'outline',
          notice && state.notice!.refused
            ? '3px dashed #b3261e'
            : state.selection === individual.id
              ? '2px solid #bd7132'
              : '',
        );
      }
      const nextPartyOrder = partyKeys.join('\0');
      if (partyOrder !== nextPartyOrder) {
        partyCards.replaceChildren(
          yoursLabel,
          ...partyKeys.map((key) => partyControls.get(key)!.button),
        );
        partyOrder = nextPartyOrder;
      }
      const selected = state.party?.find(({ individual }) => individual.id === state.selection);
      const moveKeys = (selected?.individual.repertoire ?? []).map(({ id }) => id);
      for (const key of moveControls.keys()) if (!moveKeys.includes(key)) moveControls.delete(key);
      for (const move of selected?.individual.repertoire ?? []) {
        const combatant = state.combat?.party.find((c) => c.id === selected?.individual.id);
        const cooldown = combatant?.cooldowns[move.id];
        const cost = deliveries[move.delivery].focus;
        const armed = state.autopilotMoveId === move.id;
        let entry = moveControls.get(move.id);
        if (!entry) {
          entry = cachedControl(() => actions.useMove?.(move.id));
          moveControls.set(move.id, entry);
        }
        const button = entry.button;
        text(
          entry.label,
          `${move.name}${armed ? ' ↻' : ''}${cooldown?.remaining ? ` ◷${Math.ceil(cooldown.remaining)}` : ''}`,
        );
        attribute(button, 'data-move-id', move.id);
        write(button.style, 'flex', '1 1 0');
        write(button.style, 'minWidth', '0px');
        const unavailable = Boolean(
          combatant && (combatant.focus < cost || (cooldown?.remaining ?? 0) > 0),
        );
        property(button, 'disabled', !state.combat && unavailable);
        write(button.style, 'opacity', unavailable ? '0.45' : '1');
        attribute(button, 'aria-pressed', String(armed));
        attribute(
          button,
          'data-autopilot',
          armed ? (state.autopilotYielding ? 'yielding' : 'holding') : undefined,
        );
        const notice = applyNotice(entry, move.id, state.notice);
        write(
          button.style,
          'outline',
          notice && state.notice!.refused
            ? '3px dashed #b3261e'
            : armed
              ? state.autopilotYielding
                ? '2px dashed #bd7132'
                : '2px solid #bd7132'
              : '',
        );
        const children: Node[] = [entry.label];
        if (notice) children.push(entry.detail);
        if (
          children.some((child, index) => button.childNodes[index] !== child) ||
          button.childNodes.length !== children.length
        )
          button.replaceChildren(...children);
        write(
          button.style,
          'background',
          cooldown?.remaining
            ? `linear-gradient(to top,#aaa ${(cooldown.remaining / cooldown.total) * 100}%,#f4efd9ee 0)`
            : '#f4efd9ee',
        );
      }
      const nextMoveOrder = moveKeys.join('\0');
      if (moveOrder !== nextMoveOrder) {
        moves.replaceChildren(movesLabel, ...moveKeys.map((key) => moveControls.get(key)!.button));
        moveOrder = nextMoveOrder;
      }
    },
    targetBar,
    tray,
  };
};

export { createHud, updateDetectionTarget };
export type { DetectionTargetElements, HudActions, HudState };
