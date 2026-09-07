import { describe, expect, it } from 'vitest';
import { buildArena, scenarioFromQuery, scenarios } from './scenarios.js';
describe('scenarios', () => {
  it('parses a known scenario id from the query string', () =>
    expect(scenarioFromQuery('?scenario=party')?.id).toBe('party'));
  it('falls back to the normal game for an unknown id', () =>
    expect(scenarioFromQuery('?scenario=nope')).toBeNull());
  it('ships the five named scenarios with a goal, a start tile and a phase', () => {
    expect(scenarios.map((s) => s.id)).toEqual(['world', 'creatures', 'guide', 'party', 'arena']);
    expect(scenarios.every((s) => s.goal && Number.isInteger(s.start.tx) && s.phase)).toBe(true);
  });
  it('builds the arena as a flat twenty by twelve grid with six rock tiles', () => {
    const arena = buildArena();
    let rocks = 0;
    for (let y = 0; y < 12; y++)
      for (let x = 0; x < 20; x++) if (arena.tileAt(x, y).surface === 'rock') rocks++;
    expect([arena.width, arena.height, rocks]).toEqual([20, 12, 6]);
  });
  it('disables screen flipping in the arena', () =>
    expect(buildArena().screenFlipping).toBe(false));
});
