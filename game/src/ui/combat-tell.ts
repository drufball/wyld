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
        element.setAttribute('aria-live', 'polite');
        element.textContent = tell.text;
        element.style.left = `${tell.left}px`;
        element.style.top = `${tell.top}px`;
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
