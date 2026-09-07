import { describe, expect, it } from 'vitest';
import { createRng } from '../engine/rng.js';
import { roll } from './individual.js';
import { species } from './species.js';

describe('individual rolls', () => {
  it('rolls integer stats and weighted declared temperaments', () => {
    for (const [speciesIndex, entry] of species().entries()) {
      const counts: Record<string, number> = {};
      const rng = createRng(10_000 + speciesIndex);
      for (let index = 0; index < 1000; index++) {
        const individual = roll(entry, rng, `${entry.id}-${index}`);
        for (const stat of ['vigor', 'power', 'speed', 'focus'] as const) {
          expect(Number.isInteger(individual.stats[stat])).toBe(true);
          expect(individual.stats[stat]).toBeGreaterThanOrEqual(entry.stats[stat][0]);
          expect(individual.stats[stat]).toBeLessThanOrEqual(entry.stats[stat][1]);
        }
        expect(entry.temperament[individual.temperament]).toBeDefined();
        counts[individual.temperament] = (counts[individual.temperament] ?? 0) + 1;
      }
      for (const [temperament, weight] of Object.entries(entry.temperament))
        expect((counts[temperament] ?? 0) / 1000).toBeCloseTo(weight, 1);
    }
  });
  it('creates the signature repertoire with fresh defaults', () => {
    for (const entry of species()) {
      const individual = roll(entry, createRng(1), 'fixed');
      expect(individual.repertoire).toHaveLength(entry.signatureMoves.length);
      entry.signatureMoves.forEach((move, index) => {
        expect(individual.repertoire[index]!.id).toBe(
          `${entry.id}:${move.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        );
        expect(individual.repertoire[index]).toMatchObject({
          ...move,
          cooldownMult: 1,
          rangeMult: 1,
          modifiers: [],
          familiarity: 0,
          upgradeLevel: 0,
        });
      });
    }
  });
  it('is deterministic for an injected id and seed', () => {
    const entry = species()[0]!;
    expect(roll(entry, createRng(42), 'same')).toEqual(roll(entry, createRng(42), 'same'));
    const first = Array.from({ length: 20 }, (_, index) =>
      roll(entry, createRng(42 + index), 'same'),
    );
    const second = Array.from({ length: 20 }, (_, index) =>
      roll(entry, createRng(142 + index), 'same'),
    );
    expect(
      first.some((value, index) => JSON.stringify(value) !== JSON.stringify(second[index])),
    ).toBe(true);
  });
  it('round-trips through JSON', () => {
    const individual = roll(species()[0]!, createRng(9), 'serial');
    expect(JSON.parse(JSON.stringify(individual))).toEqual(individual);
  });
});
