import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { Species, type SpeciesData, type SpeciesDraft } from './species.js';
import { applyDrafts, describeShip, serialiseSpecies, shipTitle, summariseShip } from './ship.js';

const base: SpeciesData = {
  id: 'loamox',
  name: 'Loamox',
  rarity: 'standing',
  tier: 1,
  bodyPlan: 'heavy-quadruped',
  hide: 'Bark',
  innate: [],
  forces: ['Impact'],
  stats: { vigor: [40, 50], power: [2, 3], speed: [3, 4], focus: [30, 40] },
  temperament: { Bold: 1 },
  habitat: [{ region: 'grove', phases: ['Day'] }],
  signatureMoves: [],
  tracks: { kind: 'prints' },
  hints: { tracks: 'Deep', call: 'Low', identified: 'Horns' },
  call: { waveform: 'sine', notes: [{ freq: 100, dur: 1 }] },
  palette: { primary: '#112233', secondary: '#445566' },
  visual: { length: 1, height: 1 },
};
const draft = (
  speciesId: string,
  state: SpeciesDraft['state'],
  data: SpeciesData | null,
): SpeciesDraft => ({ speciesId, state, data, updatedAt: '2026-01-01T00:00:00.000Z' });

const fixture = `[
  ${JSON.stringify(base, null, 2).replaceAll('\n', '\n  ')},
  ${JSON.stringify({ ...base, id: 'dunecask', name: 'Dunecask' }, null, 2)
    .replace(
      '"temperament": {\n    "Bold": 1\n  }',
      '"temperament": {\n    "Skittish": 0.1,\n    "Bold": 0.9\n  }',
    )
    .replace(
      '"visual": {\n    "length": 1,\n    "height": 1\n  }',
      '"visual": {\n    "height": 1.0,\n    "length": 1.0\n  }',
    )
    .replaceAll('\n', '\n  ')}
]\n`;

describe('creature workshop shipping', () => {
  it('applies edited, new and deleted drafts in order', () => {
    const mossback = { ...base, id: 'mossback', name: 'Mossback' };
    const result = applyDrafts(
      [base, { ...base, id: 'dunecask', name: 'Dunecask' }],
      [
        draft('mossback', 'new', mossback),
        draft('loamox', 'edited', { ...base, tier: 2 }),
        draft('dunecask', 'deleted', null),
      ],
    );
    expect(result.map(({ id }) => id)).toEqual(['loamox', 'mossback']);
    expect(result[0]?.tier).toBe(2);
  });

  it('lists the fields that changed on a species', () => {
    expect(
      summariseShip(
        [base],
        [
          draft('loamox', 'edited', {
            ...base,
            name: 'New name',
            palette: { ...base.palette, primary: '#000000' },
          }),
        ],
      ).changed,
    ).toEqual([{ id: 'loamox', fields: ['name', 'palette'] }]);
  });

  it('counts added, removed and changed species in the title', () => {
    expect(shipTitle({ added: ['a'], removed: ['b'], changed: [{ id: 'c', fields: [] }] })).toBe(
      'Workshop: 3 species changed',
    );
    expect(shipTitle({ added: ['a'], removed: [], changed: [] })).toBe(
      'Workshop: 1 species changed',
    );
  });

  it('leaves untouched species byte for byte', () => {
    const parsed = Species.array().parse(JSON.parse(fixture));
    const untouched = fixture.slice(fixture.indexOf('{', fixture.indexOf('dunecask') - 20), -2);
    const shipped = serialiseSpecies(fixture, [
      { ...parsed[0]!, palette: { ...base.palette, primary: '#000000' } },
      parsed[1]!,
    ]);
    expect(shipped).toContain(untouched);
    expect(shipped).toBe(fixture.replace('#112233', '#000000'));
  });

  it('keeps the original key order inside a changed species', () => {
    const parsed = Species.array().parse(JSON.parse(fixture));
    const shipped = serialiseSpecies(fixture, [
      parsed[0]!,
      { ...parsed[1]!, palette: { ...parsed[1]!.palette, primary: '#000000' } },
    ]);
    const changed = shipped.slice(shipped.indexOf('"dunecask"'));
    expect(changed.indexOf('"Skittish"')).toBeLessThan(changed.indexOf('"Bold"'));
    expect(changed.indexOf('"height"')).toBeLessThan(changed.indexOf('"length"'));
  });

  it('appends a new species in the canonical field order', () => {
    const added = { ...base, id: 'mossback', name: 'Mossback' };
    const shipped = serialiseSpecies('[]\n', [added]);
    expect(shipped.indexOf('"id"')).toBeLessThan(shipped.indexOf('"name"'));
    expect(JSON.parse(shipped)).toEqual([added]);
  });

  it('removes a species and its separating comma', () => {
    expect(serialiseSpecies(fixture, [Species.parse(base)])).toBe(
      `[\n  ${JSON.stringify(base, null, 2).replaceAll('\n', '\n  ')}\n]\n`,
    );
  });

  it('still parses back to the shipped value', async () => {
    const species = Species.array().parse(
      JSON.parse(await readFile('../../game/src/data/species.json', 'utf8')),
    );
    expect(
      JSON.parse(
        serialiseSpecies(await readFile('../../game/src/data/species.json', 'utf8'), species),
      ),
    ).toEqual(species);
  });

  it('names Dru in the pull request body', () => {
    expect(
      describeShip(
        {
          added: ['mossback'],
          removed: ['dunecask'],
          changed: [{ id: 'loamox', fields: ['palette', 'stats'] }],
        },
        {
          before: [base, { ...base, id: 'dunecask', name: 'Dunecask' }],
          after: [base, { ...base, id: 'mossback', name: 'Mossback' }],
        },
      ),
    ).toBe(
      "Shipped by Dru from the Pak's creature workshop.\n\n- **Loamox** (`loamox`) — palette, stats\n- **Mossback** (`mossback`) — new species\n- **Dunecask** (`dunecask`) — removed",
    );
  });
});
