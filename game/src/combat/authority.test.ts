import { describe, expect, it } from 'vitest';
import { authority, autopilotHolds, hears, moveTapAuthority } from './authority.js';

describe('authority', () => {
  it('floors move-tap authority at fifteen percent', () => expect(moveTapAuthority(0)).toBe(0.15));
  it('is full within two tiles and reaches zero at eight for a Steady creature', () =>
    expect([0, 2, 5, 8, 9].map((d) => authority(d, 'Steady'))).toEqual([1, 1, 0.5, 0, 0]));
  it('is full within two tiles and reaches zero at eight for a Bold creature', () =>
    expect([0, 2, 5, 8].map((d) => authority(d, 'Bold'))).toEqual([1, 1, 0.5, 0]));
  it('is full within two tiles and reaches zero at six for a Skittish creature', () =>
    expect([0, 2, 4, 6].map((d) => authority(d, 'Skittish'))).toEqual([1, 1, 0.5, 0]));
  it('is full within two tiles and reaches zero at four for an Erratic creature', () =>
    expect([0, 2, 3, 4].map((d) => authority(d, 'Erratic'))).toEqual([1, 1, 0.5, 0]));
  it('always hears a tap at one tile', () => {
    for (const t of ['Steady', 'Bold', 'Skittish', 'Erratic'] as const)
      for (const r of [0, 0.5, 0.999]) expect(hears(authority(1, t), r)).toBe(true);
  });
  it('never hears a tap at nine tiles for any temperament', () => {
    for (const t of ['Steady', 'Bold', 'Skittish', 'Erratic'] as const)
      for (const r of [0, 0.5, 0.999]) expect(hears(authority(9, t), r)).toBe(false);
  });
  it('never hears an Erratic creature at five tiles', () =>
    expect([0, 0.999].map((r) => hears(authority(5, 'Erratic'), r))).toEqual([false, false]));
  it('holds the autopilot at half authority and yields below it', () => {
    expect(autopilotHolds(0.5)).toBe(true);
    expect(autopilotHolds(0.499)).toBe(false);
  });
});
