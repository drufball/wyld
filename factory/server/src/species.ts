import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { SpeciesLibrary } from '@wyld/sprites';
import { log, type LogContext } from './logger.js';

type SpeciesRouteOptions = {
  repoDir?: string;
  logger?: (level: 'info' | 'error', msg: string, context?: LogContext) => void;
};
export function createSpeciesRoutes({ repoDir, logger = log }: SpeciesRouteOptions) {
  const app = new Hono();
  app.get('/species', async (c) => {
    try {
      if (!repoDir) throw new Error('The repository directory is not configured');
      const dataDir = path.join(repoDir, 'game/src/data');
      const [speciesText, worldText] = await Promise.all([
        readFile(path.join(dataDir, 'species.json'), 'utf8'),
        readFile(path.join(dataDir, 'world.json'), 'utf8'),
      ]);
      const world = JSON.parse(worldText) as { regions?: unknown[] };
      return c.json(
        SpeciesLibrary.parse({
          species: JSON.parse(speciesText),
          regions: (world.regions ?? []).map((region) => {
            const { id, name, biome } = region as Record<string, unknown>;
            return { id, name, biome };
          }),
        }),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      logger('error', 'Unable to read creature data', { reason });
      return c.json({ error: `Could not read creature data: ${reason}` }, 500);
    }
  });
  return app;
}
