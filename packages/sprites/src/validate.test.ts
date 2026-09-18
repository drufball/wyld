/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SpeciesData } from './schemas.js';
import { validateHints, validateSpecies } from './validate.js';
const shipped = JSON.parse(
  readFileSync(new URL('../../../game/src/data/species.json', import.meta.url), 'utf8'),
) as SpeciesData[];
const regions = [
  'hollow',
  'deep-wood',
  'pond-hollow',
  'fern-chasm',
  'south-shore',
  'near-island',
  'stack-island',
  'long-island',
  'channels',
  'dunes',
  'salt-flats',
  'mesa',
  'ash-fields',
  'vents',
  'crater-rim',
];
const copy = () => JSON.parse(JSON.stringify(shipped)) as SpeciesData[];
describe('species validation', () => {
  it('accepts the shipped species table', () =>
    expect(validateSpecies(shipped, regions)).toEqual([]));
  it('rejects a stat outside its tier band', () => {
    const x = copy();
    x[0]!.stats.vigor = [0, 1];
    expect(validateSpecies(x, regions).join()).toContain('outside its tier band');
  });
  it('rejects a delivery the body plan cannot use', () => {
    const x = copy();
    x[0]!.signatureMoves[0]!.delivery = 'Bolt';
    expect(validateSpecies(x, regions).join()).toContain(
      'uses a delivery heavy-quadruped cannot perform',
    );
  });
  it('allows Kelpmaw its authored Arc move', () => {
    const kelpmaw = shipped.find((entry) => entry.id === 'kelpmaw');
    expect(kelpmaw).toBeDefined();
    expect(validateSpecies([kelpmaw], regions)).toEqual([]);
  });
  it('rejects an unknown hide', () => {
    const x = copy() as unknown as Record<string, unknown>[];
    x[0]!.hide = 'Silk';
    expect(validateSpecies(x, regions).join()).toContain('hide is invalid');
  });
  it('rejects temperament weights that do not sum to 1', () => {
    const x = copy();
    x[0]!.temperament = { Bold: 0.5 };
    expect(validateSpecies(x, regions).join()).toContain('sum to');
  });
  it('rejects a palette colour that is not #rrggbb', () => {
    const x = copy();
    x[0]!.palette.primary = 'red';
    expect(validateSpecies(x, regions).join()).toContain('#rrggbb');
  });
  it('rejects a hint that names a region', () =>
    expect(
      validateHints(
        [{ name: 'Fox', hints: { tracks: 'Pond Hollow mud', call: 'x', identified: 'x' } }],
        ['Pond Hollow'],
      ).join(),
    ).toContain('names a region'));
  it('rejects a hint that names a species', () =>
    expect(
      validateHints(
        [{ name: 'Fox', hints: { tracks: 'a fox trail', call: 'x', identified: 'x' } }],
        [],
      ).join(),
    ).toContain('names a species'));
  it('rejects a hint that names a phase but allows lower-case prose', () => {
    const entry = {
      name: 'Fox',
      hints: { tracks: 'At Dusk', call: 'the heat of the day', identified: 'x' },
    };
    expect(validateHints([entry], [])).toHaveLength(1);
  });
  it('allows a species name in the identified hint', () =>
    expect(
      validateHints(
        [{ name: 'Fox', hints: { tracks: 'marks', call: 'cry', identified: 'A Fox' } }],
        [],
      ),
    ).toEqual([]));
});
