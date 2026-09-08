import { describe, expect, it } from 'vitest';
import { buildArenaIndividual, enemy, rosterMember } from '../arena/roster.js';
import { forces, hides, speciesById } from '../creatures/species.js';
import { canAfford, damage, deliveries, windup } from './resolve.js';
import type { Move } from './moves.js';
import type { HideType } from '../creatures/species.js';

const member = (id: string) => buildArenaIndividual(rosterMember(id)!);

describe('combat resolution', () => {
  it('does 14 into Bark from a power-3 Impact Strike at Power 3', () =>
    expect(damage(member('loamox').repertoire[0]!, 3, 'Bark')).toBe(14));
  it('does 28 back into Vigor 70 from a power-5 Impact at Power 5', () => {
    const move = buildArenaIndividual(enemy('antlerback')!).repertoire.find(
      (m) => m.power === 5 && m.force === 'Impact',
    )!;
    // The spec's 29 uses 0.6 + 5/10 = 1.15; the arithmetic result is 1.1 and 28 damage.
    expect(damage(move, 5, speciesById('loamox')!.hide)).toBe(28);
  });
  it('does 48 from a power-6 Heat move at Power 4 into Bark', () =>
    expect(
      damage({ ...member('emberjack').repertoire[0]!, power: 6, force: 'Heat' }, 4, 'Bark'),
    ).toBe(48));
  it('multiplies damage by every hide and force pair', () => {
    for (const hide of hides)
      for (const force of forces) {
        const move: Move = {
          ...member('loamox').repertoire[0]!,
          power: 2,
          force: force as Move['force'],
        };
        const expected =
          force ===
          ({ Bark: 'Heat', Shell: 'Impact', Scale: 'Surge', Hide: 'Cut', Stone: 'Surge' } as const)[
            hide
          ]
            ? 1.6
            : force ===
                (
                  {
                    Bark: 'Cut',
                    Shell: 'Cut',
                    Scale: 'Heat',
                    Hide: 'Surge',
                    Stone: 'Impact',
                  } as const
                )[hide]
              ? 0.6
              : 1;
        expect(damage(move, 4, hide as HideType)).toBe(Math.round(10 * expected));
      }
  });
  it('winds up the Shove in 0.5184 s', () =>
    expect(windup(member('loamox').repertoire[0]!, 4)).toBeCloseTo(0.5184));
  it('clamps windup to a quarter second', () =>
    expect(windup({ ...member('loamox').repertoire[0]!, speed: 5 }, 10)).toBe(0.25));
  it('cannot afford Arc on ten focus', () => {
    const move = { ...member('loamox').repertoire[0]!, delivery: 'Arc' as const };
    expect(deliveries.Arc.focus).toBe(12);
    expect(canAfford(10, move)).toBe(false);
    expect(canAfford(12, move)).toBe(true);
  });
});
