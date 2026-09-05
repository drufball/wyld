import { asc, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  Event,
  EventId,
  NewEvent,
  Presence,
  WakeMessage,
  type NewEvent as NewEventType,
} from '@wyld/shared';
import { z } from 'zod';

import type { AppDatabase } from './database.js';
import { log, type LogContext } from './logger.js';
import { events, presence } from './schema.js';

const EventQuery = z.object({
  since: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

const ReplayQuery = z.object({
  since: z.coerce.number().int().min(0).optional(),
});

type Subscriber = (event: Event) => Promise<void>;

export type AppDependencies = {
  database: AppDatabase;
  version?: string;
  wakeUrl?: string;
  now?: () => Date;
  fetch?: typeof globalThis.fetch;
  logger?: (level: 'info' | 'error', msg: string, context?: LogContext) => void;
};

function formatIssues(error: z.ZodError) {
  return { error: 'Invalid request', issues: error.issues };
}

export function createApp(dependencies: AppDependencies) {
  const { db, sqlite } = dependencies.database;
  const now = dependencies.now ?? (() => new Date());
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  const logger = dependencies.logger ?? log;
  const subscribers = new Set<Subscriber>();
  const startedAt = Date.now();
  const app = new Hono();

  const listEvents = (since: number, limit?: number): Event[] => {
    const query = db.select().from(events).where(gt(events.id, since)).orderBy(asc(events.id));
    const rows = limit === undefined ? query.all() : query.limit(limit).all();
    return rows.map((row) =>
      Event.parse({
        id: row.id,
        ts: row.ts,
        source: row.source,
        kind: row.kind,
        payload: row.payload,
        ...(row.questId === null ? {} : { questId: row.questId }),
      }),
    );
  };

  const forwardToWake = (event: Event): void => {
    if (event.source !== 'human') return;
    const wakeUrl = dependencies.wakeUrl;
    if (wakeUrl === undefined) {
      logger('info', 'would forward to Wake', { eventId: event.id, kind: event.kind });
      return;
    }
    const text = event.payload['summary'] ?? event.payload['text'];
    const message = WakeMessage.parse({
      source: event.source,
      kind: event.kind,
      ...(event.questId === undefined ? {} : { quest: event.questId }),
      summary: typeof text === 'string' && text.length > 0 ? text : event.kind,
      ts: event.ts,
    });
    void Promise.resolve()
      .then(() =>
        fetcher(wakeUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(message),
        }),
      )
      .then((response) => {
        if (!response.ok) throw new Error(`Wake returned HTTP ${response.status}`);
      })
      .catch((error: unknown) => {
        logger('error', 'failed to forward to Wake', { eventId: event.id, error: String(error) });
      });
  };

  const storeEvent = async (newEvent: NewEventType): Promise<Event> => {
    const ts = now().toISOString();
    const [row] = db
      .insert(events)
      .values({
        ts,
        source: newEvent.source,
        kind: newEvent.kind,
        payload: newEvent.payload,
        questId: newEvent.questId,
      })
      .returning()
      .all();
    if (row === undefined) throw new Error('Event insert did not return a row');
    const event = Event.parse({ ...newEvent, id: row.id, ts });
    for (const subscriber of subscribers) {
      void Promise.resolve()
        .then(() => subscriber(event))
        .catch((error: unknown) => {
          logger('error', 'failed to send event to SSE subscriber', {
            eventId: event.id,
            error: String(error),
          });
        });
    }
    forwardToWake(event);
    return event;
  };

  app.post('/api/events', async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = NewEvent.safeParse(body);
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    return c.json(await storeEvent(parsed.data), 201);
  });

  app.get('/api/events', (c) => {
    const parsed = EventQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    return c.json(listEvents(parsed.data.since, parsed.data.limit));
  });

  app.get('/api/events/stream', (c) => {
    const parsedQuery = ReplayQuery.safeParse(c.req.query());
    const parsedHeader =
      c.req.header('Last-Event-ID') === undefined
        ? undefined
        : EventId.safeParse(Number(c.req.header('Last-Event-ID')));
    if (!parsedQuery.success) return c.json(formatIssues(parsedQuery.error), 400);
    if (parsedHeader !== undefined && !parsedHeader.success)
      return c.json(formatIssues(parsedHeader.error), 400);
    const since = parsedHeader?.data ?? parsedQuery.data.since ?? 0;

    return streamSSE(c, async (stream) => {
      let lastSent = since;
      let chain = Promise.resolve();
      const send: Subscriber = (event) => {
        chain = chain.then(async () => {
          if (event.id <= lastSent) return;
          await stream.writeSSE({
            id: String(event.id),
            event: 'event',
            data: JSON.stringify(event),
          });
          lastSent = event.id;
        });
        return chain;
      };
      subscribers.add(send);
      const ping = setInterval(() => void stream.write(': ping\n\n'), 20_000);
      try {
        for (const event of listEvents(since)) await send(event);
        await new Promise<void>((resolve) => stream.onAbort(resolve));
      } finally {
        clearInterval(ping);
        subscribers.delete(send);
      }
    });
  });

  const readPresence = (): Presence => {
    const row = db.select().from(presence).where(eq(presence.id, 1)).get();
    if (row === undefined) throw new Error('Presence row is missing');
    return Presence.parse({
      lastSeenAt: row.lastSeenAt,
      lastCatchupEventId: row.lastCatchupEventId,
      nextAction: { text: row.nextActionText, deepLink: row.nextActionLink },
    });
  };

  app.get('/api/presence', (c) => c.json(readPresence()));

  app.post('/api/presence/seen', async (c) => {
    const seenAt = now().toISOString();
    db.update(presence).set({ lastSeenAt: seenAt }).where(eq(presence.id, 1)).run();
    await storeEvent({ source: 'human', kind: 'human.seen', payload: {} });
    return c.json(readPresence());
  });

  app.get('/api/health', (c) => {
    let databaseStatus: 'ok' | 'error' = 'ok';
    try {
      sqlite.prepare('SELECT 1').get();
    } catch {
      databaseStatus = 'error';
    }
    return c.json({
      ok: databaseStatus === 'ok',
      db: databaseStatus,
      uptimeSeconds: (Date.now() - startedAt) / 1000,
      version: dependencies.version ?? '0.0.0',
    });
  });

  return app;
}
