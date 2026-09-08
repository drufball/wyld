import { describe, expect, it } from 'vitest';
import { hideMultiplier, weakness } from '../combat/hides.js';
import { speciesById } from '../creatures/species.js';
import { arenaEnemies, arenaRoster, buildArenaIndividual, counters } from './roster.js';

describe('arena roster', () => {
  it('keeps Barrow the Loamox on the roster', () =>
    expect(arenaRoster()).toContainEqual(
      expect.objectContaining({ id: 'loamox', name: 'Barrow' }),
    ));

  it("carries every enemy's weakness on at least two roster creatures", () =>
    arenaEnemies().forEach((entry) => {
      expect(counters(entry.id).length, entry.name).toBeGreaterThanOrEqual(2);
    }));

  it("gives every roster creature a neutral-or-better force against an enemy's hide", () =>
    arenaRoster().forEach((entry) => {
      const forces = buildArenaIndividual(entry).repertoire.map((move) => move.force);
      const useful = arenaEnemies().some((foe) => {
        const hide = speciesById(foe.speciesId)!.hide;
        return forces.some((force) => hideMultiplier(hide, force) >= 1);
      });
      expect(useful, entry.name).toBe(true);
    }));

  it('uses existing species ids', () =>
    [...arenaRoster(), ...arenaEnemies()].forEach((entry) =>
      expect(speciesById(entry.speciesId)).not.toBeNull(),
    ));

  it('takes moves from species signatures', () =>
    [...arenaRoster(), ...arenaEnemies()].forEach((entry) =>
      expect(buildArenaIndividual(entry).repertoire.map((move) => move.name)).toEqual(
        speciesById(entry.speciesId)!.signatureMoves.map((move) => move.name),
      ),
    ));

  it('takes fixed stats and temperament from arena data rather than rolling them', () =>
    [...arenaRoster(), ...arenaEnemies()].forEach((entry) =>
      expect(buildArenaIndividual(entry)).toMatchObject({
        stats: entry.stats,
        temperament: entry.temperament,
      }),
    ));

  it('keeps enemies in tier two bands with the documented weaknesses', () =>
    arenaEnemies().forEach((entry) => {
      expect(entry.stats.vigor).toBeGreaterThanOrEqual(120);
      expect(entry.stats.vigor).toBeLessThanOrEqual(200);
      expect(weakness(speciesById(entry.speciesId)!.hide)).toBeTruthy();
    }));
});
