// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVignette } from './vignette.js';

const capabilities = (reducedMotion: boolean, supported: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reducedMotion })),
  );
  vi.stubGlobal('CSS', { supports: vi.fn(() => supported) });
};

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('vignette', () => {
  it('always renders the gradient', () => {
    capabilities(false, true);
    const on = createVignette();
    expect(on.element.style.background).toContain('radial-gradient');
    on.dispose();
    capabilities(true, true);
    const off = createVignette();
    expect(off.element.style.background).toContain('radial-gradient');
  });

  it('drops the blur under reduced motion', () => {
    capabilities(true, true);
    const vignette = createVignette();
    expect(vignette.element.dataset).toMatchObject({
      blur: 'off',
      blurReason: 'reduced-motion',
    });
    expect(vignette.element.children).toHaveLength(0);
  });

  it('drops the blur when backdrop-filter is unsupported', () => {
    capabilities(false, false);
    const vignette = createVignette();
    expect(vignette.element.dataset.blur).toBe('off');
    expect(vignette.element.dataset.blurReason).toBe('unsupported');
  });

  it('drops the blur on a slow frame budget and does not bring it back', () => {
    capabilities(false, true);
    const vignette = createVignette();
    expect(vignette.element.dataset.blur).toBe('on');
    expect(vignette.element.children).toHaveLength(1);
    vignette.refresh({ samples: 120, frameMsP95: 40 });
    expect(vignette.element.dataset).toMatchObject({ blur: 'off', blurReason: 'slow' });
    expect(vignette.element.children).toHaveLength(0);
    vignette.refresh({ samples: 120, frameMsP95: 5 });
    expect(vignette.element.dataset).toMatchObject({ blur: 'off', blurReason: 'slow' });
  });
});
