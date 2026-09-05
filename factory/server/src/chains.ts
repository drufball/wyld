import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { Chain, type NewEvent } from '@wyld/shared';
import { z } from 'zod';

import type { AppDatabase } from './database.js';
import { formatIssues } from './quests.js';
import { chainMessages, chains } from './schema.js';

export const CHAIN_QUIET_SECONDS = 86_400;
export const CHAIN_LIMIT = 5;

const ChainCreate = z.object({ text: z.string().min(1).max(2000) }).strict();
const MessageCreate = z
  .object({ author: z.enum(['human', 'planner']), text: z.string().min(1).max(2000) })
  .strict();
const ChainClose = z
  .object({
    reason: z.enum(['settled', 'converted']),
    questId: z.string().min(1).optional(),
    source: z.enum(['human', 'planner']).default('human'),
  })
  .strict();

type Dependencies = {
  database: AppDatabase;
  now: () => Date;
  storeEvent: (event: NewEvent) => Promise<unknown>;
};

export function createChainRoutes({ database: { db }, now, storeEvent }: Dependencies) {
  const app = new Hono();
  const notFound = (c: Context) => c.json({ error: 'Not Found' }, 404);
  const readChain = (id: number) => {
    const row = db.select().from(chains).where(eq(chains.id, id)).get();
    if (row === undefined) return undefined;
    const messages = db
      .select()
      .from(chainMessages)
      .where(eq(chainMessages.chainId, id))
      .orderBy(asc(chainMessages.id))
      .all();
    return Chain.parse({ ...row, messages });
  };

  app.get('/chains', (c) => {
    const cutoff = new Date(now().getTime() - CHAIN_QUIET_SECONDS * 1000).toISOString();
    db.update(chains)
      .set({ status: 'settled' })
      .where(and(eq(chains.status, 'open'), lt(chains.lastActivityAt, cutoff)))
      .run();
    const rows = db
      .select()
      .from(chains)
      .where(eq(chains.status, 'open'))
      .orderBy(desc(chains.lastActivityAt))
      .limit(CHAIN_LIMIT)
      .all();
    if (rows.length === 0) return c.json([]);
    const messages = db
      .select()
      .from(chainMessages)
      .where(
        inArray(
          chainMessages.chainId,
          rows.map(({ id }) => id),
        ),
      )
      .orderBy(asc(chainMessages.id))
      .all();
    return c.json(
      rows.map((row) =>
        Chain.parse({ ...row, messages: messages.filter((m) => m.chainId === row.id) }),
      ),
    );
  });

  app.post('/chains', async (c) => {
    const parsed = ChainCreate.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const ts = now().toISOString();
    const row = db
      .insert(chains)
      .values({ status: 'open', createdAt: ts, lastActivityAt: ts, questId: null })
      .returning({ id: chains.id })
      .get();
    db.insert(chainMessages)
      .values({ chainId: row.id, author: 'human', text: parsed.data.text, ts })
      .run();
    await storeEvent({
      source: 'human',
      kind: 'human.question',
      payload: { chainId: row.id, text: parsed.data.text },
    });
    return c.json(readChain(row.id)!, 201);
  });

  app.post('/chains/:id/messages', async (c) => {
    const id = Number(c.req.param('id'));
    const current = Number.isInteger(id) ? readChain(id) : undefined;
    if (current === undefined || current.status !== 'open') return notFound(c);
    const parsed = MessageCreate.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const ts = now().toISOString();
    db.insert(chainMessages)
      .values({ chainId: id, ...parsed.data, ts })
      .run();
    db.update(chains).set({ lastActivityAt: ts }).where(eq(chains.id, id)).run();
    await storeEvent({
      source: parsed.data.author,
      kind: parsed.data.author === 'human' ? 'human.question' : 'planner.chain_updated',
      payload: { chainId: id, text: parsed.data.text },
    });
    return c.json(readChain(id)!, 201);
  });

  app.post('/chains/:id/close', async (c) => {
    const id = Number(c.req.param('id'));
    const current = Number.isInteger(id) ? readChain(id) : undefined;
    if (current === undefined) return notFound(c);
    const parsed = ChainClose.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    db.update(chains)
      .set({
        status: parsed.data.reason,
        ...(parsed.data.questId === undefined ? {} : { questId: parsed.data.questId }),
      })
      .where(eq(chains.id, id))
      .run();
    const firstText = current.messages[0]?.text ?? '';
    const text =
      `${parsed.data.reason === 'settled' ? 'Settled' : 'Made a quest of'}: ${firstText}`.slice(
        0,
        160,
      );
    await storeEvent({
      source: parsed.data.source,
      kind: parsed.data.source === 'human' ? 'human.chain_closed' : 'planner.chain_updated',
      payload:
        parsed.data.source === 'human'
          ? { chainId: id, reason: parsed.data.reason, text }
          : { chainId: id, text },
    });
    return c.json(readChain(id)!);
  });

  return app;
}
