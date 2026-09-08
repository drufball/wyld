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

  it('writes species with a stable key order', () => {
    const text = serialiseSpecies([base]);
    expect(text.indexOf('"id"')).toBeLessThan(text.indexOf('"name"'));
    expect(text.endsWith('\n')).toBe(true);
    expect(serialiseSpecies([base])).toBe(text);
  });

  it('serialises the shipped table back to an identical value', async () => {
    const species = Species.array().parse(
      JSON.parse(await readFile('../../game/src/data/species.json', 'utf8')),
    );
    expect(JSON.parse(serialiseSpecies(species))).toEqual(species);
  });

  it('describes the change set for the pull request body', () => {
    expect(
      describeShip(
        {
          added: ['mossback'],
          removed: ['dunecask'],
          changed: [{ id: 'loamox', fields: ['palette', 'stats'] }],
        },
        [
          base,
          { ...base, id: 'mossback', name: 'Mossback' },
          { ...base, id: 'dunecask', name: 'Dunecask' },
        ],
      ),
    ).toBe(
      '- **Loamox** (`loamox`) — palette, stats\n- **Mossback** (`mossback`) — new species\n- **Dunecask** (`dunecask`) — removed\n\nShipped from the creature workshop.',
    );
  });
});
