import { describe, expect, it } from 'vitest';

import { DAY_SECONDS, nextPhaseStart, phaseBoundariesBetween, timeAt } from './time.js';

describe('time schedule', () => {
  it('has four exact three-minute phases in a twelve-minute day', () => {
    expect(DAY_SECONDS).toBe(720);
    expect([0, 180, 360, 540, 720].map((time) => timeAt(time))).toMatchObject([
      { phase: 'Dawn', day: 1 },
      { phase: 'Day', day: 1 },
      { phase: 'Dusk', day: 1 },
      { phase: 'Night', day: 1 },
      { phase: 'Dawn', day: 2 },
    ]);
  });

  it('finds the strictly next start of every phase', () => {
    expect(nextPhaseStart(10, 'Dawn')).toBe(720);
    expect(nextPhaseStart(10, 'Day')).toBe(180);
    expect(nextPhaseStart(200, 'Dusk')).toBe(360);
    expect(nextPhaseStart(540, 'Night')).toBe(1260);
  });

  it('reports every skipped boundary exactly once', () => {
    expect(phaseBoundariesBetween(179, 721).map(({ phase, day }) => ({ phase, day }))).toEqual([
      { phase: 'Day', day: 1 },
      { phase: 'Dusk', day: 1 },
      { phase: 'Night', day: 1 },
      { phase: 'Dawn', day: 2 },
    ]);
  });
});
