import { and, asc, desc, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  Event,
  EventId,
  Catchup,
  CatchupDigest,
  CatchupView,
  NewEvent,
  NextAction,
  Presence,
  type NewEvent as NewEventType,
} from '@wyld/shared';
import { z } from 'zod';

import type { AppDatabase } from './database.js';
import { log, type LogContext } from './logger.js';
import { catchups, events, presence, quests } from './schema.js';
import { mechanicalDigest } from './catchup.js';
import { createStaticHandler } from './static.js';
import { createWakeForwarder } from './forwarder.js';
import { createQuestRoutes, formatIssues } from './quests.js';

const EventQuery = z.object({
  since: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

const ReplayQuery = z.object({
  since: z.coerce.number().int().min(0).optional(),
});

const CatchupPost = z
  .object({
    digest: CatchupDigest,
    fromEventId: z.number().int().min(0).optional(),
    toEventId: z.number().int().min(0).optional(),
  })
  .refine(
    (value) =>
      value.fromEventId === undefined ||
      value.toEventId === undefined ||
      value.toEventId >= value.fromEventId,
    {
      message: 'toEventId must be greater than or equal to fromEventId',
      path: ['toEventId'],
    },
  );

export const CATCHUP_AWAY_SECONDS = 7200;
export const CATCHUP_UNSEEN_EVENTS = 20;

type Subscriber = (event: Event) => Promise<void>;

export type AppDependencies = {
  database: AppDatabase;
  version?: string;
  wakeUrl?: string;
  wakeSecret?: string;
  now?: () => Date;
  fetch?: typeof globalThis.fetch;
  logger?: (level: 'info' | 'error', msg: string, context?: LogContext) => void;
  pakDist?: string;
};

export function createApp(dependencies: AppDependencies) {
  const { db, sqlite } = dependencies.database;
  const now = dependencies.now ?? (() => new Date());
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

  const forwardToWake = createWakeForwarder({
    wakeUrl: dependencies.wakeUrl,
    wakeSecret: dependencies.wakeSecret,
    fetch: dependencies.fetch,
    logger,
  });

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
      nextAction:
        row.nextActionText === null
          ? null
          : {
              text: row.nextActionText,
              ...(row.nextActionLink === null ? {} : { deepLink: row.nextActionLink }),
            },
    });
  };

  app.get('/api/presence', (c) => c.json(readPresence()));

  const eventRange = () => {
    const currentPresence = readPresence();
    const from = currentPresence.lastCatchupEventId ?? 0;
    const to = db.select({ id: events.id }).from(events).orderBy(desc(events.id)).get()?.id ?? 0;
    return { currentPresence, from, to };
  };

  const parseCatchup = (row: typeof catchups.$inferSelect) => Catchup.parse(row);

  app.get('/api/catchup', (c) => {
    const { currentPresence, from, to } = eventRange();
    const matching = (generatedBy: 'planner' | 'mechanical') =>
      db
        .select()
        .from(catchups)
        .where(
          and(
            eq(catchups.fromEventId, from),
            eq(catchups.toEventId, to),
            eq(catchups.generatedBy, generatedBy),
          ),
        )
        .get();
    let row = matching('planner') ?? matching('mechanical');
    const unseenEvents = listEvents(from);
    if (row === undefined) {
      const digest = mechanicalDigest({
        events: unseenEvents,
        quests: db
          .select({
            id: quests.id,
            worldId: quests.worldId,
            title: quests.title,
            status: quests.status,
          })
          .from(quests)
          .all(),
      });
      [row] = db
        .insert(catchups)
        .values({
          fromEventId: from,
          toEventId: to,
          digest,
          generatedBy: 'mechanical',
          createdAt: now().toISOString(),
        })
        .returning()
        .all();
    }
    if (row === undefined) throw new Error('Catch-up insert did not return a row');
    const awaySeconds = Math.max(
      0,
      Math.floor((now().getTime() - new Date(currentPresence.lastSeenAt).getTime()) / 1000),
    );
    return c.json(
      CatchupView.parse({
        show: awaySeconds > CATCHUP_AWAY_SECONDS || unseenEvents.length > CATCHUP_UNSEEN_EVENTS,
        awaySeconds,
        unseenCount: unseenEvents.length,
        catchup: parseCatchup(row),
        nextAction: currentPresence.nextAction,
      }),
    );
  });

  app.post('/api/catchup', async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = CatchupPost.safeParse(body);
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const range = eventRange();
    const fromEventId = parsed.data.fromEventId ?? range.from;
    const toEventId = parsed.data.toEventId ?? range.to;
    if (toEventId < fromEventId) {
      const error = CatchupPost.safeParse({ ...parsed.data, fromEventId, toEventId });
      if (!error.success) return c.json(formatIssues(error.error), 400);
    }
    const createdAt = now().toISOString();
    const [row] = db
      .insert(catchups)
      .values({
        fromEventId,
        toEventId,
        digest: parsed.data.digest,
        generatedBy: 'planner',
        createdAt,
      })
      .onConflictDoUpdate({
        target: [catchups.fromEventId, catchups.toEventId, catchups.generatedBy],
        set: { digest: parsed.data.digest, createdAt },
      })
      .returning()
      .all();
    if (row === undefined) throw new Error('Catch-up upsert did not return a row');
    return c.json(parseCatchup(row), 201);
  });

  app.post('/api/presence/next-action', async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = NextAction.safeParse(body);
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    db.update(presence)
      .set({ nextActionText: parsed.data.text, nextActionLink: parsed.data.deepLink ?? null })
      .where(eq(presence.id, 1))
      .run();
    await storeEvent({
      source: 'planner',
      kind: 'planner.next_action',
      payload: parsed.data,
    });
    return c.json(readPresence());
  });

  app.post('/api/presence/seen', async (c) => {
    const seenAt = now().toISOString();
    db.update(presence).set({ lastSeenAt: seenAt }).where(eq(presence.id, 1)).run();
    await storeEvent({ source: 'human', kind: 'human.seen', payload: {} });
    const latestEventId =
      db.select({ id: events.id }).from(events).orderBy(desc(events.id)).get()?.id ?? null;
    db.update(presence).set({ lastCatchupEventId: latestEventId }).where(eq(presence.id, 1)).run();
    return c.json(readPresence());
  });

  app.route('/api', createQuestRoutes({ database: dependencies.database, now, storeEvent }));

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

  if (dependencies.pakDist !== undefined) app.all('*', createStaticHandler(dependencies.pakDist));
  app.notFound((c) => c.json({ error: 'Not Found' }, 404));

  return app;
}
