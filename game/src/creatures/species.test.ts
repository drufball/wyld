import { describe, expect, it } from 'vitest';
import { validateHints, validateSpecies } from '@wyld/sprites';
import { regions } from '../world/regions.js';
import { isEligible, species } from './species.js';
import type { SpeciesData } from './species.js';

const fixture: Record<string, Record<string, string[]>> = {
  loamox: { hollow: ['Day', 'Dusk'], 'deep-wood': ['Day', 'Dusk'] },
  bramblehog: { hollow: ['Dawn', 'Dusk'], 'pond-hollow': ['Dawn', 'Dusk'] },
  thornwren: { hollow: ['Dawn'], 'deep-wood': ['Dawn'], 'fern-chasm': ['Dawn'] },
  mirefin: { 'pond-hollow': ['Dusk', 'Night'], 'south-shore': ['Dusk', 'Night'] },
  antlerback: { 'deep-wood': ['Day'] },
  tidewhelk: {
    'near-island': ['Dawn', 'Day', 'Dusk', 'Night'],
    'south-shore': ['Dawn', 'Day', 'Dusk', 'Night'],
  },
  saltwing: { 'stack-island': ['Day'], 'long-island': ['Day'] },
  kelpmaw: { channels: ['Night'], 'long-island': ['Night'] },
  emberjack: { dunes: ['Night', 'Dawn'], 'salt-flats': ['Night', 'Dawn'] },
  dunecask: { mesa: ['Day'], dunes: ['Day'] },
  glasswing: { 'salt-flats': ['Dusk'] },
  ashcrawl: {
    'ash-fields': ['Dawn', 'Day', 'Dusk', 'Night'],
    vents: ['Dawn', 'Day', 'Dusk', 'Night'],
  },
  pyreclaw: { 'crater-rim': ['Night'] },
};
const phases = ['Dawn', 'Day', 'Dusk', 'Night'] as const;
const cloneData = (): SpeciesData[] => structuredClone(species()) as SpeciesData[];

describe('species data', () => {
  it('matches every habitat eligibility combination', () => {
    expect(Object.keys(fixture).sort()).toEqual(
      species()
        .map(({ id }) => id)
        .sort(),
    );
    let combinations = 0;
    for (const [id, habitats] of Object.entries(fixture))
      for (const region of regions())
        for (const phase of phases) {
          combinations++;
          expect(isEligible(id, region.id, phase)).toBe(
            habitats[region.id]?.includes(phase) ?? false,
          );
        }
    expect(combinations).toBe(13 * regions().length * 4);
  });
  it('rejects unknown ids', () => {
    expect(isEligible('unknown', 'hollow', 'Day')).toBe(false);
    expect(isEligible('loamox', 'unknown', 'Day')).toBe(false);
  });
  it('validates the real table', () =>
    expect(
      validateSpecies(
        species(),
        regions().map(({ id }) => id),
      ),
    ).toEqual([]));
  it.each([
    [
      'unknown habitat region',
      (data: SpeciesData[]) => {
        data[0]!.habitat[0]!.region = 'unknown';
      },
      'unknown region',
    ],
    [
      'temperament total',
      (data: SpeciesData[]) => {
        data[0]!.temperament = { Steady: 0.9 };
      },
      'sum to',
    ],
    [
      'tier band',
      (data: SpeciesData[]) => {
        data[0]!.stats.vigor = [39, 75];
      },
      'tier band',
    ],
    [
      'unavailable move force',
      (data: SpeciesData[]) => {
        data[0]!.signatureMoves[0]!.force = 'Cut';
      },
      'unavailable force',
    ],
    [
      'duplicate id',
      (data: SpeciesData[]) => {
        data[1]!.id = data[0]!.id;
      },
      'duplicate species id',
    ],
  ])('rejects %s', (_name, mutate, message) => {
    const data = cloneData();
    mutate(data);
    expect(
      validateSpecies(
        data,
        regions().map(({ id }) => id),
      ).join('\n'),
    ).toContain(message);
  });
  it('uses only supported body plans and hides', () => {
    const plans = [
      'heavy-quadruped',
      'light-quadruped',
      'avian',
      'amphibious',
      'serpentine',
      'shelled',
      'crawler',
      'large-biped',
    ];
    const hides = ['Bark', 'Shell', 'Scale', 'Hide', 'Stone'];
    for (const entry of species()) {
      expect(plans).toContain(entry.bodyPlan);
      expect(hides).toContain(entry.hide);
    }
  });
  it('keeps discovery hints free of answers they are meant to nudge towards', () => {
    expect(validateHints(species(), regions().map(({ name }) => name))).toEqual([]);
  });
});
