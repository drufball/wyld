import { createHmac, timingSafeEqual } from 'node:crypto';

import { Event, WakeMessage } from '@wyld/shared';
import { and, asc, inArray, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { enqueueMessage, type AppDatabase } from './database.js';
import { log, type LogContext, type LogLevel } from './logger.js';
import { isBotGithubSender, normaliseEvent, normaliseGithub } from './normalise.js';
import { messages } from './schema.js';

const Claim = z.object({ limit: z.number().int().positive().max(100).default(20) }).strict();
const Ack = z.object({ ids: z.array(z.number().int().positive()).max(1000) }).strict();

export type WakeAppDependencies = {
  database: AppDatabase;
  wakeSecret: string;
  githubWebhookSecret: string;
  version?: string;
  now?: () => Date;
  logger?: (level: LogLevel, msg: string, context?: LogContext) => void;
};

function equalSecret(actual: string | undefined, expected: string): boolean {
  if (actual === undefined) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createWakeApp(dependencies: WakeAppDependencies) {
  const app = new Hono();
  const { database } = dependencies;
  const now = dependencies.now ?? (() => new Date());
  const logger = dependencies.logger ?? log;
  const startedAt = Date.now();
  const drop = (reason: string) => {
    logger('debug', 'dropped Wake ingress', { reason });
    return new Response(null, { status: 204 });
  };

  app.post('/event', async (c) => {
    if (!equalSecret(c.req.header('X-Wake-Secret'), dependencies.wakeSecret))
      return drop('invalid secret');
    const body: unknown = await c.req.json().catch(() => undefined);
    const event = Event.safeParse(body);
    if (!event.success) return drop('invalid event body');
    const message = normaliseEvent(event.data);
    if (message === undefined) return drop('event did not pass gate');
    enqueueMessage(database, message, now());
    return c.body(null, 204);
  });

  app.post('/gh', async (c) => {
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    const signature = c.req.header('X-Hub-Signature-256');
    const expected = `sha256=${createHmac('sha256', dependencies.githubWebhookSecret).update(bytes).digest('hex')}`;
    if (!equalSecret(signature, expected)) return drop('invalid GitHub signature');
    const eventType = c.req.header('X-GitHub-Event');
    if (eventType === undefined) return drop('missing GitHub event type');
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return drop('invalid GitHub body');
    }
    if (eventType === 'issue_comment' && isBotGithubSender(body))
      return drop('GitHub issue comment sent by bot');
    const message = normaliseGithub(eventType, body, now());
    if (message === undefined) return drop('unhandled GitHub event');
    enqueueMessage(database, message, now());
    return c.body(null, 204);
  });

  app.get('/health', (c) => {
    const stats = database.sqlite
      .prepare(
        `SELECT COUNT(*) AS queueDepth, MIN(ts) AS oldestPendingTs FROM messages WHERE delivered_at IS NULL`,
      )
      .get() as { queueDepth: number; oldestPendingTs: string | null };
    const delivery = database.sqlite
      .prepare(`SELECT MAX(delivered_at) AS lastDeliveryAt FROM messages`)
      .get() as { lastDeliveryAt: string | null };
    const github = database.sqlite
      .prepare(`SELECT MAX(ts) AS lastGithubEventAt FROM messages WHERE source = 'github'`)
      .get() as { lastGithubEventAt: string | null };
    return c.json({
      ok: true,
      queueDepth: stats.queueDepth,
      lastDeliveryAt: delivery.lastDeliveryAt,
      lastGithubEventAt: github.lastGithubEventAt,
      oldestPendingTs: stats.oldestPendingTs,
      uptimeSeconds: (Date.now() - startedAt) / 1000,
      version: dependencies.version ?? '0.0.0',
    });
  });

  app.post('/queue/claim', async (c) => {
    if (!equalSecret(c.req.header('X-Wake-Secret'), dependencies.wakeSecret))
      return c.json({ error: 'Unauthorized' }, 401);
    const body: unknown = await c.req.json().catch(() => ({}));
    const parsed = Claim.safeParse(body);
    if (!parsed.success)
      return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400);
    const rows = database.db
      .select()
      .from(messages)
      .where(isNull(messages.deliveredAt))
      .orderBy(asc(messages.ts), asc(messages.id))
      .limit(parsed.data.limit)
      .all();
    return c.json({
      messages: rows.map((row) => ({
        id: row.id,
        ...WakeMessage.parse({
          source: row.source,
          kind: row.kind,
          ...optional('quest', row.quest),
          ...optional('issue', row.issue),
          ...optional('pr', row.pr),
          ...optional('chain', row.chain),
          ...optional('url', row.url),
          summary: row.summary,
          ts: row.ts,
        }),
      })),
    });
  });

  app.post('/queue/ack', async (c) => {
    if (!equalSecret(c.req.header('X-Wake-Secret'), dependencies.wakeSecret))
      return c.json({ error: 'Unauthorized' }, 401);
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = Ack.safeParse(body);
    if (!parsed.success)
      return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400);
    if (parsed.data.ids.length === 0) return c.json({ acked: 0 });
    const result = database.db
      .update(messages)
      .set({ deliveredAt: now().toISOString() })
      .where(and(inArray(messages.id, parsed.data.ids), isNull(messages.deliveredAt)))
      .run();
    return c.json({ acked: result.changes });
  });
  return app;
}

function optional(key: string, value: unknown): object {
  return value === null || value === undefined ? {} : { [key]: value };
}
