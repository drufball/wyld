import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSpeciesRoutes } from './species.js';

const species = {
  id: 'testling',
  name: 'Testling',
  rarity: 'standing',
  tier: 1,
  bodyPlan: 'avian',
  hide: 'Bark',
  innate: [],
  forces: ['Cut'],
  stats: { vigor: [40, 50], power: [2, 3], speed: [4, 5], focus: [30, 40] },
  temperament: { Bold: 1 },
  habitat: [{ region: 'grove', phases: ['Day'] }],
  signatureMoves: [{ name: 'Peck', delivery: 'Strike', force: 'Cut', power: 2, speed: 4 }],
  tracks: { kind: 'feather' },
  hints: { tracks: 'Soft', call: 'Bright', identified: 'Small' },
  call: { waveform: 'sine', notes: [{ freq: 440, dur: 0.2 }] },
  palette: { primary: '#112233', secondary: '#445566' },
  visual: { wings: 1 },
};

describe('species routes', () => {
  let repoDir: string;

  beforeEach(async () => {
    repoDir = await mkdtemp(path.join(os.tmpdir(), 'wyld-species-'));
    await mkdir(path.join(repoDir, 'game/src/data'), { recursive: true });
    await writeFile(
      path.join(repoDir, 'game/src/data/world.json'),
      JSON.stringify({
        regions: [{ id: 'grove', name: 'Test Grove', biome: 'woods', extra: true }],
      }),
    );
  });

  afterEach(() => rm(repoDir, { recursive: true, force: true }));

  it('serves the species and the world regions from the checkout', async () => {
    await writeFile(path.join(repoDir, 'game/src/data/species.json'), JSON.stringify([species]));
    const response = await createSpeciesRoutes({ repoDir, logger: () => undefined }).request(
      '/species',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      species: [species],
      regions: [{ id: 'grove', name: 'Test Grove', biome: 'woods' }],
    });
  });

  it('answers 500 when the species file is missing', async () => {
    const response = await createSpeciesRoutes({ repoDir, logger: () => undefined }).request(
      '/species',
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: expect.stringContaining('creature data') });
  });

  it('answers 500 when the species file does not match the schema', async () => {
    await writeFile(
      path.join(repoDir, 'game/src/data/species.json'),
      JSON.stringify([{ ...species, tier: 9 }]),
    );
    const response = await createSpeciesRoutes({ repoDir, logger: () => undefined }).request(
      '/species',
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: expect.stringContaining('creature data') });
  });
});
