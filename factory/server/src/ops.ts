import { desc } from 'drizzle-orm';
import { Hono } from 'hono';
import { OpsReport } from '@wyld/shared';

import type { AppDatabase } from './database.js';
import { formatIssues } from './quests.js';
import { opsReports } from './schema.js';

type Dependencies = {
  database: AppDatabase;
  now: () => Date;
};

export function latestOpsReport({ db }: AppDatabase) {
  return db.select().from(opsReports).orderBy(desc(opsReports.ts)).get();
}

export function createOpsRoutes({ database, now }: Dependencies) {
  const app = new Hono();

  app.post('/ops/report', async (c) => {
    const parsed = OpsReport.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const [row] = database.db
      .insert(opsReports)
      .values({ ts: now().toISOString(), ...parsed.data })
      .returning()
      .all();
    if (row === undefined) throw new Error('Ops report insert did not return a row');
    return c.json(row, 201);
  });

  return app;
}
