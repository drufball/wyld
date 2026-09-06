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
import { chains } from './schema.js';

type Dependencies = {
  database: AppDatabase;
  now: () => Date;
  storeEvent: (event: NewEvent) => Promise<unknown>;
  resumePause?: (lane: string, options?: { decideRumble?: boolean }) => Promise<number>;
};

const RumbleQuery = z.object({ status: z.enum(['open', 'decided']).optional() });
export type RumbleRow = typeof chains.$inferSelect;

export const compareRumbles = (left: RumbleRow, right: RumbleRow) => {
  const leftOpen = left.chosen === null;
  const rightOpen = right.chosen === null;
  if (leftOpen !== rightOpen) return leftOpen ? -1 : 1;
  if (leftOpen) {
    const outage = Number(right.rumbleKind === 'outage') - Number(left.rumbleKind === 'outage');
    if (outage !== 0) return outage;
    const blockers = (right.blockingQuestIds?.length ?? 0) - (left.blockingQuestIds?.length ?? 0);
    if (blockers !== 0) return blockers;
    const created = left.createdAt.localeCompare(right.createdAt);
    if (created !== 0) return created;
  } else {
    const decided = (right.chosenAt ?? '').localeCompare(left.chosenAt ?? '');
    if (decided !== 0) return decided;
  }
  return (left.slug ?? '').localeCompare(right.slug ?? '');
};

export function listOrderedRumbleRows(database: AppDatabase, status?: 'open' | 'decided') {
  return database.db
    .select()
    .from(chains)
    .where(eq(chains.kind, 'rumble'))
    .all()
    .filter((row) => status === undefined || (status === 'open') === (row.chosen === null))
    .sort(compareRumbles);
}

export const parseRumble = (row: RumbleRow) =>
  Rumble.parse({
    id: row.slug,
    title: row.title,
    context: row.context,
    options: row.options,
    chosen: row.chosen,
    chosenAt: row.chosenAt,
    blockingQuestIds: row.blockingQuestIds,
    kind: row.rumbleKind,
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
    while (db.select({ id: chains.slug }).from(chains).where(eq(chains.slug, id)).get())
      id = `${base}-${suffix++}`;
  }
  const existing = db.select().from(chains).where(eq(chains.slug, id)).get();
  if (existing === undefined) {
    const createdAt = now().toISOString();
    db.insert(chains)
      .values({
        kind: 'rumble',
        tags: ['rumble', data.kind],
        status: data.chosen === undefined ? 'open' : 'settled',
        createdAt,
        lastActivityAt: data.chosenAt ?? createdAt,
        questId: null,
        snoozedUntil: null,
        slug: id,
        title: data.title,
        context: data.context,
        options: data.options,
        chosen: data.chosen ?? null,
        chosenAt: data.chosen === undefined ? null : (data.chosenAt ?? createdAt),
        blockingQuestIds: data.blockingQuestIds,
        rumbleKind: data.kind,
      })
      .run();
  } else {
    const chosenAt = data.chosenAt ?? now().toISOString();
    db.update(chains)
      .set({
        tags: ['rumble', data.kind],
        title: data.title,
        context: data.context,
        options: data.options,
        rumbleKind: data.kind,
        blockingQuestIds: data.blockingQuestIds,
        ...(data.chosen === undefined
          ? {}
          : { chosen: data.chosen, chosenAt, status: 'settled', lastActivityAt: chosenAt }),
      })
      .where(eq(chains.slug, id))
      .run();
  }
  return db.select().from(chains).where(eq(chains.slug, id)).get()!;
}

export function decideRumbleRow(
  database: AppDatabase,
  slug: string,
  chosen: string,
  chosenAt: string,
) {
  database.db
    .update(chains)
    .set({ chosen, chosenAt, status: 'settled', lastActivityAt: chosenAt })
    .where(eq(chains.slug, slug))
    .run();
}

export function clearRumbleChoice(database: AppDatabase, slug: string) {
  database.db
    .update(chains)
    .set({ chosen: null, chosenAt: null, status: 'open' })
    .where(eq(chains.slug, slug))
    .run();
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
      .from(chains)
      .where(eq(chains.slug, c.req.param('id')))
      .get();
    if (rumble === undefined || rumble.kind !== 'rumble') return notFound(c);
    const parsed = RumbleDecision.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const options = rumble.options ?? [];
    if (!options.includes(parsed.data.chosen)) {
      return c.json(
        {
          error: 'Invalid request',
          issues: [
            {
              code: 'custom',
              path: ['chosen'],
              message: `chosen must be one of: ${options.join(', ')}`,
            },
          ],
        },
        400,
      );
    }
    const chosenAt = now().toISOString();
    decideRumbleRow(database, rumble.slug!, parsed.data.chosen, chosenAt);
    await storeEvent({
      source: 'human',
      kind: 'human.decision',
      ...(rumble.blockingQuestIds?.[0] === undefined
        ? {}
        : { questId: rumble.blockingQuestIds[0] }),
      payload: {
        rumbleId: rumble.slug!,
        chosen: parsed.data.chosen,
        blockingQuestIds: rumble.blockingQuestIds ?? [],
        text: `${rumble.title} → ${parsed.data.chosen}`,
      },
    });
    if (rumble.rumbleKind === 'outage' && parsed.data.chosen === 'Resume')
      await resumePause?.(rumble.slug!.replace(/^outage-/, ''), { decideRumble: false });
    return c.json(
      parseRumble({
        ...rumble,
        status: 'settled',
        lastActivityAt: chosenAt,
        chosen: parsed.data.chosen,
        chosenAt,
      }),
    );
  });
  return app;
}
