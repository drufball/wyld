import { describe, expect, it } from 'vitest';
import { speciesById } from '../creatures/species.js';
import { weakness } from '../combat/hides.js';
import { arenaEnemies, arenaRoster, buildArenaIndividual, counters } from './roster.js';
describe('arena roster', () => {
  it('gives every enemy exactly two counters', () =>
    arenaEnemies().forEach((e) => expect(counters(e.id)).toHaveLength(2)));
  it('gives every member exactly one enemy weakness', () =>
    arenaRoster().forEach((r) => {
      const forces = new Set(buildArenaIndividual(r).repertoire.map((m) => m.force));
      expect(
        arenaEnemies().filter((e) => forces.has(weakness(speciesById(e.speciesId)!.hide))),
      ).toHaveLength(1);
    }));
  it('uses existing species ids', () =>
    [...arenaRoster(), ...arenaEnemies()].forEach((e) =>
      expect(speciesById(e.speciesId)).not.toBeNull(),
    ));
  it('takes moves from species signatures', () =>
    [...arenaRoster(), ...arenaEnemies()].forEach((e) =>
      expect(buildArenaIndividual(e).repertoire.map((m) => m.name)).toEqual(
        speciesById(e.speciesId)!.signatureMoves.map((m) => m.name),
      ),
    ));
  it('takes fixed stats and temperament from data', () =>
    [...arenaRoster(), ...arenaEnemies()].forEach((e) =>
      expect(buildArenaIndividual(e)).toMatchObject({ stats: e.stats, temperament: e.temperament }),
    ));
  it('keeps enemies in tier two bands', () =>
    arenaEnemies().forEach((e) => {
      expect(e.stats.vigor).toBeGreaterThanOrEqual(120);
      expect(e.stats.vigor).toBeLessThanOrEqual(200);
    }));
});
