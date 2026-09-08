type ControlRow = readonly [key: string, description: string];

const buildControlRows = (debugAvailable: boolean, arena = false): ControlRow[] => {
  const rows: ControlRow[] = [
    ['Tap the ground', 'walk'],
    ['Tap a creature', 'select it'],
    ['Tap yourself', 'take back control'],
    ['?', 'this card'],
  ];
  if (!arena)
    rows.splice(3, 0, ['Tap a wild creature', 'look at it'], ['Walk to an edge', 'next screen']);
  if (debugAvailable) rows.push(['`', 'console']);
  return rows;
};

const createControlsCard = (debugAvailable: boolean, debugOpen: () => boolean, arena = false) => {
  const root = document.createElement('aside');
  root.setAttribute('aria-label', 'Controls');
  root.style.cssText =
    'position:fixed;z-index:6;bottom:64px;left:50%;transform:translateX(-50%);box-sizing:border-box;width:min(340px,calc(100vw - 24px));max-height:calc(100vh - 136px);overflow:auto;padding:12px 16px;color:#292b25;border:1px solid #777566;background:repeating-linear-gradient(0deg,#f4efd9ee 0,#f4efd9ee 21px,#cbc4a777 22px);box-shadow:1px 2px 2px #0005;font:13px/21px ui-monospace,monospace;transition:opacity 500ms;cursor:pointer';
  // Keep the HUD clearance explicit for DOM implementations that reject the paper gradient.
  root.style.bottom = '64px';
  for (const [key, description] of buildControlRows(debugAvailable, arena)) {
    const row = document.createElement('div');
    row.textContent = `${key} — ${description}`;
    root.append(row);
  }
  document.body.append(root);
  const timeout = window.setTimeout(() => hide(), 8000);
  const hide = (): void => {
    root.style.opacity = '0';
    root.style.pointerEvents = 'none';
  };
  const show = (): void => {
    root.style.opacity = '1';
    root.style.pointerEvents = 'auto';
  };
  root.addEventListener('click', hide);
  const keydown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (debugOpen() || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
      return;
    if (event.key === '?' || event.key.toLowerCase() === 'h') {
      event.preventDefault();
      window.clearTimeout(timeout);
      if (root.style.opacity === '0') show();
      else hide();
    }
  };
  window.addEventListener('keydown', keydown);
  return {
    root,
    dispose: () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', keydown);
      root.remove();
    },
  };
};

export { buildControlRows, createControlsCard };
export type { ControlRow };
