import { describe, expect, it } from 'vitest';

import { updateDetectionTarget } from './hud.js';

const elements = () => {
  const attributes = new Map<string, string>();
  const outlineAttributes = new Map<string, string>();
  return {
    attributes,
    outlineAttributes,
    value: {
      bar: { style: { display: 'unset' } },
      fill: { setAttribute: (name: string, value: string) => attributes.set(name, value) },
      outline: {
        setAttribute: (name: string, value: string) => outlineAttributes.set(name, value),
      },
    },
  };
};

describe('HUD detection target', () => {
  it('is hidden without a target', () => {
    const target = elements();
    updateDetectionTarget(target.value, null);
    expect(target.value.bar.style.display).toBe('none');
  });

  it('is visible with a detecting target', () => {
    const target = elements();
    updateDetectionTarget(target.value, { detection: 0.25 });
    expect(target.value.bar.style.display).toBe('flex');
  });

  it('scales and completes the eye fill with the meter', () => {
    const target = elements();
    updateDetectionTarget(target.value, { detection: 0.5 });
    expect(target.attributes.get('width')).toBe('19');
    updateDetectionTarget(target.value, { detection: 1 });
    expect(target.attributes.get('width')).toBe('38');
    expect(target.outlineAttributes.get('stroke')).toBe('#292b25');
  });
});
