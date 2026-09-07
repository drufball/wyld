type RegionReadout = { update(regionName: string | null, biome: string): void };

const createRegionReadout = (available: boolean): RegionReadout => {
  if (!available) return { update: () => undefined };
  const element = document.createElement('aside');
  element.setAttribute('aria-live', 'polite');
  element.style.cssText =
    'position:fixed;z-index:4;top:14px;left:14px;padding:7px 11px;background:#f5f0dce8;color:#25291f;border:1px solid #55584b;box-shadow:2px 3px 8px #0005;font:12px/18px ui-monospace,monospace;letter-spacing:.03em;pointer-events:none';
  document.body.append(element);
  let previous = '';
  return {
    update(regionName, biome): void {
      const next = `${regionName ?? 'Uncharted'} · ${biome}`;
      if (next !== previous) {
        element.textContent = next;
        previous = next;
      }
    },
  };
};

export { createRegionReadout };
export type { RegionReadout };
