import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SpeciesDraft, SpeciesLibrary, type SpeciesData } from '@wyld/sprites/workshop';
import { createSpeciesRoutes } from './species.js';
import { openDatabase, type AppDatabase } from './database.js';

const species: SpeciesData = {
  id: 'testling',
  name: 'Testling',
  rarity: 'standing',
  tier: 1,
  bodyPlan: 'heavy-quadruped',
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
  visual: { length: 1, height: 1 },
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

  const storeEditedDraft = async (
    app: ReturnType<typeof createSpeciesRoutes>,
    data: SpeciesData = { ...species, name: 'Shipped Testling' },
  ) => {
    const response = await app.request('/species/drafts/testling', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: 'edited', data }),
    });
    expect(response.status).toBe(200);
  };

  const shippingApp = (
    runCommand: NonNullable<Parameters<typeof createSpeciesRoutes>[0]['runCommand']>,
  ) =>
    createSpeciesRoutes({
      repoDir,
      worktreesDir: path.join(repoDir, 'worktrees'),
      database,
      now: () => new Date('2026-02-03T04:05:06.000Z'),
      logger: () => undefined,
      runCommand,
    });

  const recordingRunner =
    (
      commands: string[],
      fail?: (command: string, args: string[]) => Error | undefined,
    ): NonNullable<Parameters<typeof createSpeciesRoutes>[0]['runCommand']> =>
    async (command, args) => {
      commands.push([command, ...args].join(' '));
      const error = fail?.(command, args);
      if (error) throw error;
      if (args.includes('add') && args.includes('--detach')) {
        const worktree = args.at(-2)!;
        await mkdir(path.join(worktree, 'game/src/data'), { recursive: true });
      }
      if (command === 'gh') return { stdout: 'https://github.com/drufball/wyld/pull/999\n' };
      return { stdout: '' };
    };

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

  it('refuses to ship when the checkout is dirty', async () => {
    await writeSpecies();
    const commands: string[] = [];
    const app = shippingApp(async (command, args) => {
      commands.push([command, ...args].join(' '));
      return { stdout: ' M game/src/data/species.json\n' };
    });
    const response = await app.request('/species/ship', { method: 'POST' });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: expect.stringContaining('uncommitted changes'),
    });
    expect(commands).toEqual([`git -C ${repoDir} status --porcelain`]);
  });

  it('refuses to ship when nothing has changed', async () => {
    await writeSpecies();
    const commands: string[] = [];
    const response = await shippingApp(recordingRunner(commands)).request('/species/ship', {
      method: 'POST',
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Nothing has been changed yet.' });
    expect(commands).toEqual([`git -C ${repoDir} status --porcelain`]);
  });

  it('refuses to ship a draft that breaks a rule and keeps it', async () => {
    await writeSpecies();
    const commands: string[] = [];
    const app = shippingApp(recordingRunner(commands));
    await storeEditedDraft(app, {
      ...species,
      stats: { ...species.stats, vigor: [0, 1] },
    });
    const response = await app.request('/species/ship', { method: 'POST' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ shipped: false, problems: expect.any(Array) });
    expect(SpeciesLibrary.parse(await (await app.request('/species')).json()).drafts).toHaveLength(
      1,
    );
    expect(commands).toEqual([`git -C ${repoDir} status --porcelain`]);
  });

  it('keeps the drafts when the game tests fail', async () => {
    await writeSpecies();
    const commands: string[] = [];
    const app = shippingApp(
      recordingRunner(commands, (command, args) =>
        command === 'pnpm' && args.includes('test') ? new Error('tests failed') : undefined,
      ),
    );
    await storeEditedDraft(app);
    const response = await app.request('/species/ship', { method: 'POST' });
    expect(await response.json()).toMatchObject({ shipped: false });
    expect(SpeciesLibrary.parse(await (await app.request('/species')).json()).drafts).toHaveLength(
      1,
    );
  });

  it("builds the game's workspace dependencies before running its tests", async () => {
    await writeSpecies();
    const commands: string[] = [];
    const app = shippingApp(recordingRunner(commands));
    await storeEditedDraft(app);
    await app.request('/species/ship', { method: 'POST' });
    expect(commands.filter((command) => command.startsWith('pnpm '))).toEqual([
      'pnpm install --frozen-lockfile --prefer-offline',
      'pnpm exec prettier --write game/src/data/species.json',
      'pnpm --filter @wyld/game^... build',
      'pnpm --filter @wyld/game test',
    ]);
  });

  it('says the tests could not run when no test name can be parsed', async () => {
    await writeSpecies();
    const rawOutput = 'packageEntryFailure\nresolvePackageEntry\ntryNodeResolve';
    const app = shippingApp(
      recordingRunner([], (command, args) => {
        if (command !== 'pnpm' || !args.includes('test')) return undefined;
        return Object.assign(new Error('tests failed'), { stderr: rawOutput });
      }),
    );
    await storeEditedDraft(app);
    const response = await (await app.request('/species/ship', { method: 'POST' })).json();
    expect(response).toEqual({
      shipped: false,
      problems: [
        "The game's own tests could not run on this change. The details are in the factory log.",
      ],
    });
    expect(JSON.stringify(response)).not.toContain(rawOutput);
  });

  it('reports the failing test names in plain English', async () => {
    await writeSpecies();
    const app = shippingApp(
      recordingRunner([], (command, args) => {
        if (command !== 'pnpm' || !args.includes('test')) return undefined;
        return Object.assign(new Error('tests failed'), {
          stderr: ' FAIL  src/rules.test.ts\n × creature rules > rejects weak creatures 12ms\n',
        });
      }),
    );
    await storeEditedDraft(app);
    expect(await (await app.request('/species/ship', { method: 'POST' })).json()).toEqual({
      shipped: false,
      problems: ['creature rules — rejects weak creatures'],
    });
  });

  it('opens a pull request and clears the drafts when the game tests pass', async () => {
    await writeSpecies();
    const commands: string[] = [];
    const app = shippingApp(recordingRunner(commands));
    await storeEditedDraft(app);
    const response = await app.request('/species/ship', { method: 'POST' });
    expect(await response.json()).toMatchObject({
      shipped: true,
      prUrl: 'https://github.com/drufball/wyld/pull/999',
    });
    expect(SpeciesLibrary.parse(await (await app.request('/species')).json()).drafts).toEqual([]);
    const worktree = path.join(repoDir, 'worktrees/workshop');
    expect(commands).toEqual([
      `git -C ${repoDir} status --porcelain`,
      `git -C ${repoDir} worktree remove --force ${worktree}`,
      `git -C ${repoDir} worktree prune`,
      `git -C ${repoDir} fetch origin main`,
      `git -C ${repoDir} worktree add -f --detach ${worktree} origin/main`,
      `git -C ${worktree} switch -c workshop/20260203-040506`,
      'pnpm install --frozen-lockfile --prefer-offline',
      'pnpm exec prettier --write game/src/data/species.json',
      'pnpm --filter @wyld/game^... build',
      'pnpm --filter @wyld/game test',
      `git -C ${worktree} add game/src/data/species.json`,
      `git -C ${worktree} -c user.name=WYLD Creature Workshop -c user.email=workshop@wyld.local commit -m Workshop: 1 species changed`,
      `git -C ${worktree} push -u origin workshop/20260203-040506`,
      "gh pr create --base main --title Workshop: 1 species changed --body Shipped by Dru from the Pak's creature workshop.\n\n- **Shipped Testling** (`testling`) — name",
      `git -C ${repoDir} worktree remove --force ${worktree}`,
    ]);
  });

  it('removes the worktree when a step throws', async () => {
    await writeSpecies();
    const commands: string[] = [];
    const app = shippingApp(
      recordingRunner(commands, (command, args) =>
        command === 'pnpm' && args[0] === 'install' ? new Error('install failed') : undefined,
      ),
    );
    await storeEditedDraft(app);
    const response = await app.request('/species/ship', { method: 'POST' });
    expect(response.status).toBe(500);
    const removal = `git -C ${repoDir} worktree remove --force ${path.join(repoDir, 'worktrees/workshop')}`;
    expect(commands.filter((command) => command === removal)).toHaveLength(2);
  });
});
