type ControlRow = readonly [key: string, description: string];

const buildControlRows = (debugAvailable: boolean): ControlRow[] => {
  const rows: ControlRow[] = [
    ['W A S D', 'move'],
    ['Shift', 'run'],
    ['C', 'crouch'],
    ['Mouse', 'look · click to look around'],
    ['G', 'field guide'],
    ['M', 'map'],
    ['Esc', 'close / release the mouse'],
  ];
  if (debugAvailable) rows.push(['`', 'console']);
  return rows;
};

const createControlsCard = (debugAvailable: boolean, debugOpen: () => boolean) => {
  const root = document.createElement('aside');
  root.setAttribute('aria-label', 'Controls');
  root.style.cssText =
    'position:fixed;z-index:6;bottom:34px;left:50%;transform:translateX(-50%);box-sizing:border-box;width:min(340px,calc(100vw - 24px));padding:12px 16px;color:#292b25;border:1px solid #777566;background:repeating-linear-gradient(0deg,#f4efd9ee 0,#f4efd9ee 21px,#cbc4a777 22px);box-shadow:1px 2px 2px #0005;font:13px/21px ui-monospace,monospace;transition:opacity 500ms';
  for (const [key, description] of buildControlRows(debugAvailable)) {
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
