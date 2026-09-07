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
  it('builds the arena to the current screen with six deterministic rock tiles', () => {
    const arena = buildArena(11, 22);
    let rocks = 0;
    for (let y = 0; y < arena.height; y++)
      for (let x = 0; x < arena.width; x++) if (arena.tileAt(x, y).surface === 'rock') rocks++;
    expect([arena.width, arena.height, rocks]).toEqual([11, 22, 6]);
  });
  it('disables screen flipping in the arena', () =>
    expect(buildArena(20, 12).screenFlipping).toBe(false));
  it('gives the synthetic arena its own field-note goal', () => {
    expect(scenarioFromQuery('?scenario=arena')).toMatchObject({
      goal: 'A flat place to practise. Nothing lives here yet.',
      synthetic: true,
    });
  });
});
