import { execFile } from 'node:child_process';
import { readFile, readdir, stat, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { validateHints, validateSpecies } from '@wyld/sprites';
import {
  Species,
  SpeciesDraft,
  SpeciesLibrary,
  applyDrafts,
  describeShip,
  serialiseSpecies,
  shipTitle,
  summariseShip,
} from '@wyld/sprites/workshop';
import { z } from 'zod';
import type { AppDatabase } from './database.js';
import { log, type Logger } from '@wyld/shared';
import { speciesDrafts } from './schema.js';

type SpeciesRouteOptions = {
  repoDir?: string;
  worktreesDir?: string;
  database: AppDatabase;
  now?: () => Date;
  logger?: Logger;
  git?: string;
  pnpm?: string;
  gh?: string;
  runCommand?: CommandRunner;
};
type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd?: string; timeout: number },
) => Promise<{ stdout?: string; stderr?: string }>;
const execFileAsync = promisify(execFile);
const realRun: CommandRunner = async (command, args, options) =>
  execFileAsync(command, args, { ...options, encoding: 'utf8' });
const DraftBody = z.object({
  state: z.enum(['edited', 'new', 'deleted']),
  data: Species.nullable().optional(),
});
async function references(root: string, ids: readonly string[]) {
  const result = Object.fromEntries(ids.map((id) => [id, [] as string[]]));
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        const text = await readFile(file, 'utf8');
        for (const id of ids)
          if (text.includes(`'${id}'`) || text.includes(`"${id}"`))
            result[id]!.push(path.relative(root, file));
      }
    }
  }
  await walk(path.join(root, 'game/src'));
  for (const files of Object.values(result)) files.sort();
  return result;
}
export function createSpeciesRoutes({
  repoDir,
  database,
  now = () => new Date(),
  logger = log,
  worktreesDir,
  git = 'git',
  pnpm = 'pnpm',
  gh = 'gh',
  runCommand = realRun,
}: SpeciesRouteOptions) {
  const app = new Hono();
  let referenceCache:
    { directoryMtime: number; ids: string; value: Record<string, string[]> } | undefined;
  const readSpecies = async () => {
    if (!repoDir) throw new Error('The repository directory is not configured');
    return Species.array().parse(
      JSON.parse(await readFile(path.join(repoDir, 'game/src/data/species.json'), 'utf8')),
    );
  };
  app.get('/species', async (c) => {
    try {
      const species = await readSpecies();
      const world = JSON.parse(
        await readFile(path.join(repoDir!, 'game/src/data/world.json'), 'utf8'),
      ) as { regions?: unknown[] };
      const ids = species.map(({ id }) => id);
      const sourceDirectory = path.join(repoDir!, 'game/src');
      const directoryMtime = (await stat(sourceDirectory)).mtimeMs;
      const idsKey = ids.join('\0');
      if (
        !referenceCache ||
        referenceCache.directoryMtime !== directoryMtime ||
        referenceCache.ids !== idsKey
      ) {
        referenceCache = {
          directoryMtime,
          ids: idsKey,
          value: await references(repoDir!, ids),
        };
      }
      return c.json(
        SpeciesLibrary.parse({
          species,
          regions: (world.regions ?? []).map((region) => {
            const { id, name, biome } = region as Record<string, unknown>;
            return { id, name, biome };
          }),
          drafts: database.db
            .select()
            .from(speciesDrafts)
            .orderBy(asc(speciesDrafts.speciesId))
            .all(),
          references: referenceCache.value,
        }),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      logger('error', 'Unable to read creature data', { reason });
      return c.json({ error: `Could not read creature data: ${reason}` }, 500);
    }
  });
  app.put('/species/drafts/:id', async (c) => {
    const parsed = DraftBody.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success)
      return c.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, 400);
    const id = c.req.param('id');
    const { state } = parsed.data;
    const data = parsed.data.data ?? null;
    if (state !== 'deleted' && data == null) return c.json({ error: 'data is required' }, 400);
    if (state === 'deleted' && data !== null)
      return c.json({ error: 'deleted drafts must have null data' }, 400);
    if (data && data.id !== id) return c.json({ error: 'draft id does not match route' }, 400);
    if (state === 'new' && (await readSpecies()).some((item) => item.id === id))
      return c.json({ error: 'species already exists' }, 400);
    const row = SpeciesDraft.parse({
      speciesId: id,
      state,
      data: data ?? null,
      updatedAt: now().toISOString(),
    });
    database.db
      .insert(speciesDrafts)
      .values(row)
      .onConflictDoUpdate({
        target: speciesDrafts.speciesId,
        set: { state: row.state, data: row.data, updatedAt: row.updatedAt },
      })
      .run();
    return c.json(row);
  });
  app.delete('/species/drafts/:id', (c) => {
    database.db
      .delete(speciesDrafts)
      .where(eq(speciesDrafts.speciesId, c.req.param('id')))
      .run();
    return c.body(null, 204);
  });
  app.post('/species/ship', async (c) => {
    if (!repoDir || !worktreesDir)
      return c.json({ error: 'The workshop is not configured for shipping.' }, 500);
    const run = async (command: string, args: string[], cwd?: string) => {
      logger('info', 'creature workshop command', { command, args, cwd });
      return runCommand(command, args, { ...(cwd ? { cwd } : {}), timeout: 15 * 60 * 1000 });
    };
    const status = await run(git, ['-C', repoDir, 'status', '--porcelain']);
    if ((status.stdout ?? '').trim())
      return c.json(
        { error: "The workshop can't ship while there are uncommitted changes in the checkout." },
        409,
      );
    const drafts = database.db
      .select()
      .from(speciesDrafts)
      .orderBy(asc(speciesDrafts.speciesId))
      .all();
    if (drafts.length === 0) return c.json({ error: 'Nothing has been changed yet.' }, 409);
    const speciesText = await readFile(path.join(repoDir, 'game/src/data/species.json'), 'utf8');
    const file = Species.array().parse(JSON.parse(speciesText));
    const shippedSpecies = applyDrafts(
      file,
      drafts.map((draft) => SpeciesDraft.parse(draft)),
    );
    const world = JSON.parse(
      await readFile(path.join(repoDir, 'game/src/data/world.json'), 'utf8'),
    ) as {
      regions?: { id: string; name: string }[];
    };
    const regions = world.regions ?? [];
    const problems = [
      ...validateSpecies(
        shippedSpecies,
        regions.map(({ id }) => id),
      ),
      ...validateHints(
        shippedSpecies,
        regions.map(({ name }) => name),
      ),
    ];
    if (problems.length) return c.json({ shipped: false as const, problems });

    const worktree = path.join(worktreesDir, 'workshop');
    const stamp = now().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const branch = `workshop/${stamp}`;
    const summary = summariseShip(
      file,
      drafts.map((draft) => SpeciesDraft.parse(draft)),
    );
    const title = shipTitle(summary);
    let prepared = false;
    try {
      await mkdir(worktreesDir, { recursive: true });
      prepared = true;
      await run(git, ['-C', repoDir, 'worktree', 'remove', '--force', worktree]).catch(
        () => undefined,
      );
      await rm(worktree, { recursive: true, force: true });
      await run(git, ['-C', repoDir, 'worktree', 'prune']);
      await run(git, ['-C', repoDir, 'fetch', 'origin', 'main']);
      await run(git, ['-C', repoDir, 'worktree', 'add', '-f', '--detach', worktree, 'origin/main']);
      await run(git, ['-C', worktree, 'switch', '-c', branch]);
      await writeFile(
        path.join(worktree, 'game/src/data/species.json'),
        serialiseSpecies(speciesText, shippedSpecies),
      );
      await run(pnpm, ['install', '--frozen-lockfile', '--prefer-offline'], worktree);
      await run(pnpm, ['exec', 'prettier', '--write', 'game/src/data/species.json'], worktree);
      try {
        await run(pnpm, ['--filter', '@wyld/game^...', 'build'], worktree);
        await run(pnpm, ['--filter', '@wyld/game', 'test'], worktree);
      } catch (error) {
        const output = commandFailureText(error);
        logger('error', 'creature workshop game tests could not pass', { reason: output });
        return c.json({ shipped: false as const, problems: gameTestProblems(output) });
      }
      await run(git, ['-C', worktree, 'add', 'game/src/data/species.json']);
      await run(git, [
        '-C',
        worktree,
        '-c',
        'user.name=WYLD Creature Workshop',
        '-c',
        'user.email=workshop@wyld.local',
        'commit',
        '-m',
        title,
      ]);
      await run(git, ['-C', worktree, 'push', '-u', 'origin', branch]);
      const pullRequest = await run(
        gh,
        [
          'pr',
          'create',
          '--base',
          'main',
          '--title',
          title,
          '--body',
          describeShip(summary, { before: file, after: shippedSpecies }),
        ],
        worktree,
      );
      const prUrl = (pullRequest.stdout ?? '').trim();
      database.db.delete(speciesDrafts).run();
      return c.json({ shipped: true as const, summary, prUrl });
    } catch (error) {
      logger('error', 'creature workshop ship failed', { reason: commandFailureText(error) });
      return c.json({ error: 'The workshop could not ship these changes. Try again.' }, 500);
    } finally {
      if (prepared) {
        await run(git, ['-C', repoDir, 'worktree', 'remove', '--force', worktree]).catch(
          () => undefined,
        );
        await rm(worktree, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  });
  return app;
}

function commandFailureText(error: unknown): string {
  const value = error as { stdout?: unknown; stderr?: unknown; message?: unknown };
  return [value.stdout, value.stderr, value.message ?? error]
    .filter(Boolean)
    .map(String)
    .join('\n');
}

function gameTestProblems(output: string): string[] {
  const names = output.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*(?:×|✗|❯)\s+(.+?)(?:\s+\d+ms)?\s*$/u);
    if (!match || match[1]!.includes('.test.')) return [];
    return [match[1]!.replace(/ > /g, ' — ')];
  });
  return names.length
    ? [...new Set(names)]
    : ["The game's own tests could not run on this change. The details are in the factory log."];
}
