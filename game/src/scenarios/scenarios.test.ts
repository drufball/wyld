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
    const arena = buildArena(11, 22, 'forest');
    let rocks = 0;
    for (let y = 0; y < arena.height; y++)
      for (let x = 0; x < arena.width; x++) if (arena.tileAt(x, y).surface === 'rock') rocks++;
    expect([arena.width, arena.height, rocks]).toEqual([11, 22, 6]);
  });
  it('follows the chosen biome without water', () => {
    for (const biome of ['forest', 'desert', 'archipelago'] as const) {
      const arena = buildArena(20, 15, biome);
      expect(arena.tileAt(0, 0).biome).toBe(biome);
      expect(
        Array.from({ length: 300 }, (_, i) => arena.tileAt(i % 20, Math.floor(i / 20)).surface),
      ).not.toContain('water');
    }
  });
  it('makes rocks block walking but not sight', () => {
    const arena = buildArena(20, 15, 'desert');
    let rock: { x: number; y: number } | undefined;
    for (let y = 0; y < 15; y++)
      for (let x = 0; x < 20; x++) if (arena.tileAt(x, y).class === 'cover') rock = { x, y };
    expect(rock).toBeDefined();
    expect(arena.isWalkable(rock!.x, rock!.y)).toBe(false);
    expect(arena.blocksSight(rock!.x, rock!.y)).toBe(false);
  });
  it('disables screen flipping in the arena', () =>
    expect(buildArena(20, 12).screenFlipping).toBe(false));
  it('gives the synthetic arena its own field-note goal', () => {
    expect(scenarioFromQuery('?scenario=arena')).toMatchObject({
      goal: 'Open ground. Six low rocks. Pick the ground that suits the work.',
      synthetic: true,
    });
  });
});
