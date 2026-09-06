import { and, asc, count, desc, eq, gt, gte, isNull } from 'drizzle-orm';
import path from 'node:path';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  Event,
  EventId,
  HealthReport,
  HealthSnapshot,
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
import { catchups, events, healthReports, pauses, presence, quests } from './schema.js';
import { mechanicalDigest } from './catchup.js';
import { createStaticHandler } from './static.js';
import { createWakeForwarder, createWakePauseNotifier } from './forwarder.js';
import { createQuestRoutes, formatIssues } from './quests.js';
import { createChainRoutes } from './chains.js';
import { createOpsRoutes, latestOpsReport } from './ops.js';
import { createRumbleRoutes, listOrderedRumbleRows } from './rumbles.js';
import { createDemoRoutes } from './demos.js';
import { DEMO_SLUG, type DemoBuilder } from './builder.js';
import { resolveStaticFile } from './static.js';
import { createNotifier } from './notify.js';
import { createPauseRoutes, createPauseService } from './pause.js';
import { createSleepRoutes, createSleepScheduler, type SleepConfig } from './sleep.js';

const EventQuery = z.object({
  since: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

const ReplayQuery = z.object({
  since: z.coerce.number().int().min(0).optional(),
});

const NotifyPost = z
  .object({
    title: z.string().min(1).max(120),
    message: z.string().min(1).max(500),
    tags: z.array(z.string()).optional(),
    click: z.string().optional(),
  })
  .strict();

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
export const PLANNER_STALE_SECONDS = 600;
export const OPS_STALE_SECONDS = 600;

const WakeHealth = z
  .object({
    queueDepth: z.number().int().min(0).optional().catch(undefined),
    oldestPendingTs: z.string().optional().catch(undefined),
    lastDeliveryAt: z.string().optional().catch(undefined),
    lastGithubEventAt: z.string().optional().catch(undefined),
    paused: z.boolean().optional().catch(undefined),
  })
  .passthrough();

type Subscriber = (event: Event) => Promise<void>;

export type AppDependencies = {
  database: AppDatabase;
  version?: string;
  pakPublicUrl?: string;
  wakeUrl?: string;
  wakeSecret?: string;
  ntfyUrl?: string;
  ntfyTopic?: string;
  now?: () => Date;
  fetch?: typeof globalThis.fetch;
  logger?: (level: 'info' | 'error', msg: string, context?: LogContext) => void;
  pakDist?: string;
  demosDir: string;
  feedbackDir: string;
  builder?: DemoBuilder;
  sleepConfig?: SleepConfig;
};

export function createApp(dependencies: AppDependencies) {
  const { db, sqlite } = dependencies.database;
  const now = dependencies.now ?? (() => new Date());
  const logger = dependencies.logger ?? log;
  const subscribers = new Set<Subscriber>();
  const startedAt = Date.now();
  const app = new Hono();
  const notify = createNotifier({
    ntfyUrl: dependencies.ntfyUrl,
    topic: dependencies.ntfyTopic ?? 'wyld-pak',
    fetch: dependencies.fetch,
    logger,
  });

  app.post('/api/notify', async (c) => {
    const parsed = NotifyPost.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const { title, message, ...options } = parsed.data;
    notify(title, message, options);
    return c.json({ sent: dependencies.ntfyUrl !== undefined }, 202);
  });

  const serverHealth = () => {
    let databaseStatus: 'ok' | 'error' = 'ok';
    try {
      sqlite.prepare('SELECT 1').get();
    } catch {
      databaseStatus = 'error';
    }
    return {
      ok: databaseStatus === 'ok',
      db: databaseStatus,
      uptimeSeconds: (Date.now() - startedAt) / 1000,
      version: dependencies.version ?? '0.0.0',
    };
  };

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
  const notifyWakePause = createWakePauseNotifier({
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
        openRumbles: listOrderedRumbleRows(dependencies.database, 'open').map(
          ({ slug, title }) => ({
            id: slug!,
            title: title!,
          }),
        ),
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
    await setNextAction(parsed.data.text, parsed.data.deepLink ?? null);
    return c.json(readPresence());
  });

  async function setNextAction(text: string, deepLink: string | null) {
    db.update(presence)
      .set({ nextActionText: text, nextActionLink: deepLink })
      .where(eq(presence.id, 1))
      .run();
    await storeEvent({
      source: 'planner',
      kind: 'planner.next_action',
      payload: { text, ...(deepLink === null ? {} : { deepLink }) },
    });
  }

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
  const sleepConfig = dependencies.sleepConfig ?? {
    timeZone: 'UTC',
    goodnight: '23:00',
    lastCall: '07:15',
    lightsOn: '08:00',
    enabled: false,
  };
  app.route(
    '/api',
    createSleepRoutes({ database: dependencies.database, now, storeEvent, config: sleepConfig }),
  );
  createSleepScheduler({
    database: dependencies.database,
    now,
    storeEvent,
    config: sleepConfig,
    setNextAction,
  }).start();
  app.route('/api', createChainRoutes({ database: dependencies.database, now, storeEvent }));
  app.route('/api', createOpsRoutes({ database: dependencies.database, now }));
  const resumePause = createPauseService({
    database: dependencies.database,
    now,
    storeEvent,
    notifyWake: notifyWakePause,
  });
  app.route(
    '/api',
    createPauseRoutes({
      database: dependencies.database,
      now,
      storeEvent,
      notify,
      notifyWake: notifyWakePause,
      ...(dependencies.pakPublicUrl === undefined
        ? {}
        : { pakPublicUrl: dependencies.pakPublicUrl }),
    }),
  );
  app.route(
    '/api',
    createRumbleRoutes({ database: dependencies.database, now, storeEvent, resumePause }),
  );
  const builder = dependencies.builder ?? {
    build: async () => ({ ok: false as const, error: 'Demo builder is not configured' }),
    isBuilding: () => false,
  };
  app.route(
    '/api',
    createDemoRoutes({
      database: dependencies.database,
      now,
      storeEvent,
      config: { feedbackDir: dependencies.feedbackDir },
      builder,
      logger,
    }),
  );

  app.get('/api/health', (c) => c.json(serverHealth()));

  app.post('/api/health/report', async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = HealthReport.safeParse(body);
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const [row] = db
      .insert(healthReports)
      .values({ ts: now().toISOString(), ...parsed.data })
      .returning()
      .all();
    if (row === undefined) throw new Error('Health report insert did not return a row');
    return c.json(row, 201);
  });

  app.get('/api/health/snapshot', async (c) => {
    const current = now();
    const latest = db.select().from(healthReports).orderBy(desc(healthReports.ts)).get();
    const latestOps = latestOpsReport(dependencies.database);
    const activePauses = db.select().from(pauses).where(isNull(pauses.resolvedAt)).all();
    const activePause =
      activePauses.find((pause) => pause.lane === 'all') ??
      activePauses.sort((a, b) => a.since.localeCompare(b.since))[0];
    const opsFresh =
      latestOps !== undefined &&
      current.getTime() - new Date(latestOps.ts).getTime() <= OPS_STALE_SECONDS * 1000;
    const stale =
      latest === undefined ||
      current.getTime() - new Date(latest.ts).getTime() > PLANNER_STALE_SECONDS * 1000;
    let wake: z.infer<typeof HealthSnapshot>['wake'] = { reachable: false };
    if (dependencies.wakeUrl !== undefined) {
      try {
        const response = await (dependencies.fetch ?? globalThis.fetch)(
          new URL('/health', dependencies.wakeUrl),
          { signal: AbortSignal.timeout(1000) },
        );
        if (!response.ok) throw new Error(`Wake health returned ${response.status}`);
        const parsed = WakeHealth.safeParse(await response.json());
        if (!parsed.success) throw new Error('Wake health returned an invalid body');
        wake = { reachable: true, ...parsed.data };
      } catch (error: unknown) {
        logger('error', 'failed to read Wake health', { error: String(error) });
      }
    }
    const dayStart = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()),
    ).toISOString();
    const eventsToday =
      db.select({ value: count() }).from(events).where(gte(events.ts, dayStart)).get()?.value ?? 0;
    const snapshot = HealthSnapshot.parse({
      ts: current.toISOString(),
      planner: {
        state: stale ? 'down' : latest?.plannerState,
        ...(!stale && latest?.currentTask !== null ? { currentTask: latest?.currentTask } : {}),
        ...(latest === undefined ? {} : { lastReportAt: latest.ts }),
      },
      server: { ...serverHealth(), eventsToday },
      wake,
      github: opsFresh
        ? {
            ciState: latestOps.ciState,
            ...(latestOps.ciDetail === null ? {} : { ciDetail: latestOps.ciDetail }),
            ...(latestOps.ghRateRemaining === null
              ? {}
              : { rateRemaining: latestOps.ghRateRemaining }),
            ...(latestOps.ghRateLimit === null ? {} : { rateLimit: latestOps.ghRateLimit }),
            codexPrsOpen: latestOps.codexPrsOpen,
            reportedAt: latestOps.ts,
            source: 'ops',
          }
        : latest === undefined
          ? { ciState: 'unknown', source: 'none' }
          : {
              ciState: latest.ciState ?? 'unknown',
              ...(latest.ghRateRemaining === null ? {} : { rateRemaining: latest.ghRateRemaining }),
              ...(latest.codexPrsOpen === null ? {} : { codexPrsOpen: latest.codexPrsOpen }),
              reportedAt: latest.ts,
              source: 'planner',
            },
      ...(opsFresh && latestOps.tokensToday !== null ? { tokensToday: latestOps.tokensToday } : {}),
      ...(latest?.costToday == null ? {} : { costToday: latest.costToday }),
      ...(latest?.pausedReason == null ? {} : { pausedReason: latest.pausedReason }),
      ...(activePause === undefined
        ? {}
        : {
            paused: {
              lane: activePause.lane,
              reason: activePause.reason,
              ...(activePause.fix === null ? {} : { fix: activePause.fix }),
              since: activePause.since,
            },
          }),
    });
    // WakeHealth is intentionally passthrough so Wake can add diagnostics between Pak releases.
    return c.json({ ...snapshot, wake });
  });

  app.all('/play/:slug', (c) => {
    const slug = c.req.param('slug');
    if (!DEMO_SLUG.test(slug)) return c.json({ error: 'Invalid demo slug' }, 400);
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD')
      return c.json({ error: 'Not Found' }, 404);
    return c.redirect(`/play/${slug}/`, 301);
  });
  app.all('/play/:slug/*', (c) => {
    const slug = c.req.param('slug');
    if (!DEMO_SLUG.test(slug)) return c.json({ error: 'Invalid demo slug' }, 400);
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD')
      return c.json({ error: 'Not Found' }, 404);
    const prefix = `/play/${slug}`;
    const response = resolveStaticFile(
      path.join(dependencies.demosDir, slug),
      c.req.path.slice(prefix.length) || '/',
      c.req.method,
    );
    return response ?? c.json({ error: 'Demo not found' }, 404);
  });
  if (dependencies.pakDist !== undefined) app.all('*', createStaticHandler(dependencies.pakDist));
  app.notFound((c) => c.json({ error: 'Not Found' }, 404));

  return app;
}
