import { eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import {
  NewRumble,
  Rumble,
  RumbleDecision,
  type NewEvent,
  type NewRumble as NewRumbleType,
} from '@wyld/shared';
import { z } from 'zod';

import type { AppDatabase } from './database.js';
import { formatIssues } from './quests.js';
import { rumbles } from './schema.js';

type Dependencies = {
  database: AppDatabase;
  now: () => Date;
  storeEvent: (event: NewEvent) => Promise<unknown>;
  resumePause?: (lane: string, options?: { decideRumble?: boolean }) => Promise<number>;
};

const RumbleQuery = z.object({ status: z.enum(['open', 'decided']).optional() });
type RumbleRow = typeof rumbles.$inferSelect;

const compareRumbles = (left: RumbleRow, right: RumbleRow) => {
  const leftOpen = left.chosen === null;
  const rightOpen = right.chosen === null;
  if (leftOpen !== rightOpen) return leftOpen ? -1 : 1;
  if (leftOpen) {
    const outage = Number(right.kind === 'outage') - Number(left.kind === 'outage');
    if (outage !== 0) return outage;
    const blockers = right.blockingQuestIds.length - left.blockingQuestIds.length;
    if (blockers !== 0) return blockers;
    const created = left.createdAt.localeCompare(right.createdAt);
    if (created !== 0) return created;
  } else {
    const decided = (right.chosenAt ?? '').localeCompare(left.chosenAt ?? '');
    if (decided !== 0) return decided;
  }
  return left.id.localeCompare(right.id);
};

export function listOrderedRumbleRows(database: AppDatabase, status?: 'open' | 'decided') {
  return database.db
    .select()
    .from(rumbles)
    .all()
    .filter((row) => status === undefined || (status === 'open') === (row.chosen === null))
    .sort(compareRumbles);
}

export const parseRumble = (row: RumbleRow) =>
  Rumble.parse({
    id: row.id,
    title: row.title,
    context: row.context,
    options: row.options,
    chosen: row.chosen,
    chosenAt: row.chosenAt,
    blockingQuestIds: row.blockingQuestIds,
    kind: row.kind,
  });

export function writeRumble(database: AppDatabase, now: () => Date, data: NewRumbleType) {
  const { db } = database;
  let id = data.id;
  if (id === undefined) {
    const base =
      data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60)
        .replace(/-$/, '') || 'rumble';
    id = base;
    let suffix = 2;
    while (db.select({ id: rumbles.id }).from(rumbles).where(eq(rumbles.id, id)).get())
      id = `${base}-${suffix++}`;
  }
  const existing = db.select().from(rumbles).where(eq(rumbles.id, id)).get();
  if (existing === undefined) {
    db.insert(rumbles)
      .values({
        ...data,
        id,
        chosen: data.chosen ?? null,
        chosenAt: data.chosen === undefined ? null : (data.chosenAt ?? now().toISOString()),
        createdAt: now().toISOString(),
      })
      .run();
  } else {
    db.update(rumbles)
      .set({
        title: data.title,
        context: data.context,
        options: data.options,
        kind: data.kind,
        blockingQuestIds: data.blockingQuestIds,
        ...(data.chosen === undefined
          ? {}
          : { chosen: data.chosen, chosenAt: data.chosenAt ?? now().toISOString() }),
      })
      .where(eq(rumbles.id, id))
      .run();
  }
  return db.select().from(rumbles).where(eq(rumbles.id, id)).get()!;
}

export function createRumbleRoutes({ database, now, storeEvent, resumePause }: Dependencies) {
  const { db } = database;
  const app = new Hono();
  const notFound = (c: Context) => c.json({ error: 'Not Found' }, 404);

  app.get('/rumbles', (c) => {
    const parsed = RumbleQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    return c.json(listOrderedRumbleRows(database, parsed.data.status).map(parseRumble));
  });

  app.post('/rumbles', async (c) => {
    const parsed = NewRumble.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    return c.json(parseRumble(writeRumble(database, now, parsed.data)), 201);
  });

  app.post('/rumbles/:id/decide', async (c) => {
    const rumble = db
      .select()
      .from(rumbles)
      .where(eq(rumbles.id, c.req.param('id')))
      .get();
    if (rumble === undefined) return notFound(c);
    const parsed = RumbleDecision.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    if (!rumble.options.includes(parsed.data.chosen)) {
      return c.json(
        {
          error: 'Invalid request',
          issues: [
            {
              code: 'custom',
              path: ['chosen'],
              message: `chosen must be one of: ${rumble.options.join(', ')}`,
            },
          ],
        },
        400,
      );
    }
    const chosenAt = now().toISOString();
    db.update(rumbles)
      .set({ chosen: parsed.data.chosen, chosenAt })
      .where(eq(rumbles.id, rumble.id))
      .run();
    await storeEvent({
      source: 'human',
      kind: 'human.decision',
      ...(rumble.blockingQuestIds[0] === undefined ? {} : { questId: rumble.blockingQuestIds[0] }),
      payload: {
        rumbleId: rumble.id,
        chosen: parsed.data.chosen,
        blockingQuestIds: rumble.blockingQuestIds,
        text: `${rumble.title} → ${parsed.data.chosen}`,
      },
    });
    // Outages may take the Planner down, so the Resume button must work without it.
    if (rumble.kind === 'outage' && parsed.data.chosen === 'Resume') {
      await resumePause?.(rumble.id.replace(/^outage-/, ''), { decideRumble: false });
    }
    return c.json(parseRumble({ ...rumble, chosen: parsed.data.chosen, chosenAt }));
  });

  return app;
}
