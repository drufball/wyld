import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { Region, Species } from '@wyld/sprites';
import { log, type LogContext } from './logger.js';

type SpeciesRouteOptions = {
  config: { repoDir: string };
  logger?: (level: 'info' | 'error', msg: string, context?: LogContext) => void;
};
export function createSpeciesRoutes({ config, logger = log }: SpeciesRouteOptions) {
  const app = new Hono();
  app.get('/species', async (c) => {
    try {
      const dataDir = path.join(config.repoDir, 'game/src/data');
      const [speciesText, worldText] = await Promise.all([
        readFile(path.join(dataDir, 'species.json'), 'utf8'),
        readFile(path.join(dataDir, 'world.json'), 'utf8'),
      ]);
      const species = Species.array().parse(JSON.parse(speciesText));
      const world = JSON.parse(worldText) as { regions?: unknown[] };
      const regions = Region.array().parse(
        (world.regions ?? []).map((region) => {
          const { id, name, biome } = region as Record<string, unknown>;
          return { id, name, biome };
        }),
      );
      return c.json({ species, regions });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      logger('error', 'Unable to read creature data', { reason });
      return c.json({ error: `Could not read creature data: ${reason}` }, 500);
    }
  });
  return app;
}
