import { describe, expect, it } from 'vitest';
import { paletteAt, paletteKey } from './palette.js';
describe('surface palette', () => {
  it('lerps each surface colour from one phase to the next', () => {
    const dawn = paletteAt('Dawn', 0),
      day = paletteAt('Day', 0),
      halfway = paletteAt('Dawn', 0.5);
    for (const surface of Object.keys(dawn) as (keyof typeof dawn)[])
      expect(halfway[surface].base).toEqual(
        dawn[surface].base.map((n, i) => Math.round((n + day[surface].base[i]!) / 2)),
      );
  });
  it('tints the night palette toward moon blue', () => {
    const tinted = paletteAt('Dusk', 1).water.base;
    expect(tinted[2]).toBeGreaterThan(tinted[0]);
    expect(paletteAt('Night', 0).water.base).toEqual(tinted);
  });
  it('quantises the palette key to 32 steps per phase', () => {
    expect(paletteKey('Day', 0.01)).toBe(paletteKey('Day', 0.03));
    expect(paletteKey('Day', 0.04)).not.toBe(paletteKey('Day', 0.01));
  });
});
