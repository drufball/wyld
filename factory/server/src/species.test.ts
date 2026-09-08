import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SpeciesDraft, SpeciesLibrary } from '@wyld/sprites';
import { createSpeciesRoutes } from './species.js';
import { openDatabase, type AppDatabase } from './database.js';

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
  let database: AppDatabase;

  beforeEach(async () => {
    repoDir = await mkdtemp(path.join(os.tmpdir(), 'wyld-species-'));
    await mkdir(path.join(repoDir, 'game/src/data'), { recursive: true });
    database = openDatabase(path.join(repoDir, 'test.sqlite'), path.resolve('drizzle'));
    await writeFile(
      path.join(repoDir, 'game/src/data/world.json'),
      JSON.stringify({
        regions: [{ id: 'grove', name: 'Test Grove', biome: 'woods', extra: true }],
      }),
    );
  });

  afterEach(() => rm(repoDir, { recursive: true, force: true }));

  const writeSpecies = () =>
    writeFile(path.join(repoDir, 'game/src/data/species.json'), JSON.stringify([species]));

  it('returns drafts and references with the species', async () => {
    await writeSpecies();
    await writeFile(
      path.join(repoDir, 'game/src/encounter.ts'),
      "export const creature = 'testling';",
    );
    const app = createSpeciesRoutes({ repoDir, database, logger: () => undefined });
    await app.request('/species/drafts/testling', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: 'edited', data: { ...species, name: 'Draftling' } }),
    });
    const body = SpeciesLibrary.parse(await (await app.request('/species')).json());
    expect(body.drafts[0]).toMatchObject({ speciesId: 'testling', state: 'edited' });
    expect(body.references.testling).toContain('game/src/encounter.ts');
  });

  it('reports which files reference a species', async () => {
    await writeSpecies();
    await mkdir(path.join(repoDir, 'game/src/nested'));
    await writeFile(path.join(repoDir, 'game/src/nested/one.ts'), 'const id = "testling";');
    await writeFile(path.join(repoDir, 'game/src/nested/ignored.test.ts'), "'testling'");
    const body = SpeciesLibrary.parse(
      await (await createSpeciesRoutes({ repoDir, database }).request('/species')).json(),
    );
    expect(body.references.testling).toEqual(['game/src/nested/one.ts']);
  });

  it('stores a draft that fails the rules', async () => {
    await writeSpecies();
    const invalidByGameRules = { ...species, stats: { ...species.stats, vigor: [0, 1] } };
    const response = await createSpeciesRoutes({ repoDir, database }).request(
      '/species/drafts/testling',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: 'edited', data: invalidByGameRules }),
      },
    );
    expect(response.status).toBe(200);
    expect(SpeciesDraft.parse(await response.json()).data?.stats.vigor).toEqual([0, 1]);
  });

  it('refuses a draft whose id does not match the route', async () => {
    await writeSpecies();
    const response = await createSpeciesRoutes({ repoDir, database }).request(
      '/species/drafts/another',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: 'edited', data: species }),
      },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'draft id does not match route' });
  });

  it('refuses a new draft for an id that already exists', async () => {
    await writeSpecies();
    const response = await createSpeciesRoutes({ repoDir, database }).request(
      '/species/drafts/testling',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: 'new', data: species }),
      },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'species already exists' });
  });

  it('discards a draft', async () => {
    await writeSpecies();
    const app = createSpeciesRoutes({ repoDir, database });
    const stored = await app.request('/species/drafts/testling', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: 'deleted' }),
    });
    expect(stored.status).toBe(200);
    expect((await app.request('/species/drafts/testling', { method: 'DELETE' })).status).toBe(204);
    expect(SpeciesLibrary.parse(await (await app.request('/species')).json()).drafts).toEqual([]);
  });

  it('serves the species and the world regions from the checkout', async () => {
    await writeFile(path.join(repoDir, 'game/src/data/species.json'), JSON.stringify([species]));
    const response = await createSpeciesRoutes({
      repoDir,
      database,
      logger: () => undefined,
    }).request('/species');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      species: [species],
      regions: [{ id: 'grove', name: 'Test Grove', biome: 'woods' }],
      drafts: [],
      references: { testling: [] },
    });
  });

  it('answers 500 when the species file is missing', async () => {
    const response = await createSpeciesRoutes({
      repoDir,
      database,
      logger: () => undefined,
    }).request('/species');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: expect.stringContaining('creature data') });
  });

  it('answers 500 when the species file does not match the schema', async () => {
    await writeFile(
      path.join(repoDir, 'game/src/data/species.json'),
      JSON.stringify([{ ...species, tier: 9 }]),
    );
    const response = await createSpeciesRoutes({
      repoDir,
      database,
      logger: () => undefined,
    }).request('/species');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: expect.stringContaining('creature data') });
  });
});
