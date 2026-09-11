type PositionedTell = { id: number; text: string; left: number; top: number };

const createCombatTell = () => {
  const element = document.createElement('div');
  element.style.cssText =
    'position:fixed;z-index:5;transform:translate(-50%,-100%);padding:3px 6px;border:1px solid #777566;background:#f4efd9;color:#292b25;font:700 13px/18px ui-monospace,monospace;pointer-events:none;white-space:nowrap';
  document.body.append(element);
  return element;
};

const createCombatTellOverlay = () => {
  const elements = new Map<number, HTMLDivElement>();
  return {
    sync(tells: readonly PositionedTell[]): void {
      const present = new Set(tells.map(({ id }) => id));
      for (const [id, element] of elements)
        if (!present.has(id)) {
          element.remove();
          elements.delete(id);
        }
      for (const tell of tells) {
        const element = elements.get(tell.id) ?? createCombatTell();
        elements.set(tell.id, element);
        if (element.getAttribute('aria-live') !== 'polite')
          element.setAttribute('aria-live', 'polite');
        if (element.textContent !== tell.text) element.textContent = tell.text;
        const left = `${tell.left}px`;
        const top = `${tell.top}px`;
        if (element.style.left !== left) element.style.left = left;
        if (element.style.top !== top) element.style.top = top;
      }
    },
    dispose(): void {
      for (const element of elements.values()) element.remove();
      elements.clear();
    },
  };
};

export { createCombatTellOverlay };
export type { PositionedTell };
