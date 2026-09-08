import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { Species, SpeciesDraft, SpeciesLibrary } from '@wyld/sprites';
import { z } from 'zod';
import type { AppDatabase } from './database.js';
import { log, type LogContext } from './logger.js';
import { speciesDrafts } from './schema.js';

type SpeciesRouteOptions = {
  repoDir?: string;
  database: AppDatabase;
  now?: () => Date;
  logger?: (level: 'info' | 'error', msg: string, context?: LogContext) => void;
};
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
  return app;
}
