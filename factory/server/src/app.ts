import { asc, count, desc, eq, gt, gte, isNull } from 'drizzle-orm';
import path from 'node:path';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  Event,
  EventId,
  HealthReport,
  HealthSnapshot,
  CatchupDigest,
  Chain,
  NewEvent,
  NextAction,
  Presence,
  type NewEvent as NewEventType,
} from '@wyld/shared';
import { z } from 'zod';

import type { AppDatabase } from './database.js';
import { log, type LogContext } from './logger.js';
import { chainMessages, events, healthReports, pauses, presence } from './schema.js';
import {
  CATCHUP_AWAY_SECONDS,
  CATCHUP_PLANNER_ALIVE_SECONDS,
  ensureMechanicalBriefing,
} from './catchup.js';
import { createStaticHandler } from './static.js';
import { createWakeForwarder, createWakePauseNotifier } from './forwarder.js';
import { createQuestRoutes } from './quests.js';
import { formatIssues } from './validation.js';
import { createChainRoutes } from './chains.js';
import { createOpsRoutes, latestOpsReport } from './ops.js';
import { createRumbleRoutes } from './rumbles.js';
import { createDemoRoutes } from './demos.js';
import { DEMO_SLUG, type DemoBuilder } from './builder.js';
import { resolveStaticFile } from './static.js';
import { createNotifier } from './notify.js';
import { createPauseRoutes, createPauseService } from './pause.js';
import { createSleepRoutes, createSleepScheduler, type SleepConfig } from './sleep.js';
import { createAchievements } from './achievements.js';
import { createPlannerHeartbeat } from './heartbeat.js';
import {
  countNeedsYou,
  readOpenBriefing,
  upsertBriefingChain,
  replaceActionChain,
} from './chain-cards.js';
import { createArtifactRoutes, createArtifactServeRoutes } from './artifacts.js';
import { createSpeciesRoutes } from './species.js';

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
    headline: z.string().min(1).max(160).optional(),
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

export { CATCHUP_AWAY_SECONDS, CATCHUP_PLANNER_ALIVE_SECONDS };
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
  plannerTick?: boolean;
  repoDir?: string;
  worktreesDir?: string;
};

export function createApp(dependencies: AppDependencies) {
  const { db, sqlite } = dependencies.database;
  const now = dependencies.now ?? (() => new Date());
  const logger = dependencies.logger ?? log;
  const subscribers = new Set<Subscriber>();
  const startedAt = Date.now();
  const app = new Hono();
  app.use('*', async (c, next) => {
    await next();
    if (c.req.path.startsWith('/api/') || dependencies.pakDist !== undefined) {
      c.header('Access-Control-Allow-Origin', '*');
    }
  });
  app.options('/api/*', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, POST');
    c.header('Access-Control-Allow-Headers', 'content-type');
    return c.body(null, 204);
  });
  const sleepConfig = dependencies.sleepConfig ?? {
    timeZone: 'UTC',
    goodnight: '23:00',
    lastCall: '07:15',
    lightsOn: '08:00',
    enabled: false,
  };
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
    if (newEvent.kind !== 'pak.achievement_unlocked' && newEvent.kind !== 'planner.tick') {
      try {
        await achievementService.evaluate();
      } catch (error: unknown) {
        logger('error', 'failed to evaluate achievements', { error: String(error) });
      }
    }
    return event;
  };

  const achievementService = createAchievements({
    database: dependencies.database,
    now,
    storeEvent,
    timeZone: sleepConfig.timeZone,
  });
  achievementService.seed();
  void achievementService.evaluate().catch((error: unknown) => {
    logger('error', 'failed to evaluate achievements at boot', { error: String(error) });
  });

  app.get('/api/achievements', (c) => c.json(achievementService.list()));

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
              ...(row.nextActionBackAt === null ? {} : { backAt: row.nextActionBackAt }),
            },
      needsYou: countNeedsYou(dependencies.database, now().toISOString()),
    });
  };

  app.get('/api/presence', (c) => c.json(readPresence()));

  const eventRange = () => {
    const currentPresence = readPresence();
    const from = currentPresence.lastCatchupEventId ?? 0;
    const to = db.select({ id: events.id }).from(events).orderBy(desc(events.id)).get()?.id ?? 0;
    return { currentPresence, from, to };
  };

  const readBriefingChain = () => {
    const row = readOpenBriefing(dependencies.database);
    if (row === undefined) return null;
    return Chain.parse({
      ...row,
      rumble: null,
      messages: db
        .select()
        .from(chainMessages)
        .where(eq(chainMessages.chainId, row.id))
        .orderBy(chainMessages.id)
        .all(),
    });
  };

  app.get('/api/catchup', (c) => {
    ensureMechanicalBriefing(dependencies.database, now());
    return c.json(readBriefingChain());
  });

  app.post('/api/catchup', async (c) => {
    const parsed = CatchupPost.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const range = eventRange();
    const fromEventId = parsed.data.fromEventId ?? range.from;
    const toEventId = parsed.data.toEventId ?? range.to;
    if (toEventId < fromEventId) {
      const error = CatchupPost.safeParse({ ...parsed.data, fromEventId, toEventId });
      if (!error.success) return c.json(formatIssues(error.error), 400);
    }
    const result = upsertBriefingChain(
      dependencies.database,
      { digest: parsed.data.digest, headline: parsed.data.headline, fromEventId, toEventId },
      now().toISOString(),
    );
    await storeEvent({
      source: 'planner',
      kind: 'planner.chain_updated',
      payload: {
        chainId: result.chain.id,
        text: parsed.data.headline ?? "Here's where things stand.",
      },
    });
    return c.json(readBriefingChain()!, 201);
  });

  app.post('/api/presence/next-action', async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = NextAction.safeParse(body);
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    await setNextAction(parsed.data.text, parsed.data.deepLink ?? null, parsed.data.backAt ?? null);
    return c.json(readPresence());
  });

  async function setNextAction(
    text: string,
    deepLink: string | null,
    backAt: string | null = null,
  ) {
    const ts = now().toISOString();
    db.update(presence)
      .set({ nextActionText: text, nextActionLink: deepLink, nextActionBackAt: backAt })
      .where(eq(presence.id, 1))
      .run();
    const action = replaceActionChain(dependencies.database, { text, deepLink, backAt }, ts);
    await storeEvent({
      source: 'planner',
      kind: 'planner.chain_updated',
      payload: { chainId: action.id, text },
    });
    await storeEvent({
      source: 'planner',
      kind: 'planner.next_action',
      payload: {
        text,
        ...(deepLink === null ? {} : { deepLink }),
        ...(backAt === null ? {} : { backAt }),
      },
    });
  }

  app.post('/api/presence/seen', async (c) => {
    const seenAt = now().toISOString();
    db.update(presence).set({ lastSeenAt: seenAt }).where(eq(presence.id, 1)).run();
    await storeEvent({ source: 'human', kind: 'human.seen', payload: {} });
    return c.json(readPresence());
  });

  app.route('/api', createQuestRoutes({ database: dependencies.database, now, storeEvent }));
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
  createPlannerHeartbeat({
    database: dependencies.database,
    now,
    storeEvent,
    enabled: dependencies.plannerTick ?? false,
  }).start();
  app.route(
    '/api',
    createChainRoutes({
      database: dependencies.database,
      now,
      storeEvent,
      config: { feedbackDir: dependencies.feedbackDir },
    }),
  );
  app.route('/api', createArtifactRoutes({ database: dependencies.database, now, storeEvent }));
  app.route('/api', createOpsRoutes({ database: dependencies.database, now }));
  app.route(
    '/api',
    createSpeciesRoutes({
      repoDir: dependencies.repoDir,
      worktreesDir: dependencies.worktreesDir,
      database: dependencies.database,
      logger,
      now,
    }),
  );
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

  app.route('/', createArtifactServeRoutes({ database: dependencies.database, now, storeEvent }));

  app.all('/play/:slug', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
    const slug = c.req.param('slug');
    if (!DEMO_SLUG.test(slug)) return c.json({ error: 'Invalid demo slug' }, 400);
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD')
      return c.json({ error: 'Not Found' }, 404);
    return c.redirect(`/play/${slug}/`, 301);
  });
  app.all('/play/:slug/*', (c) => {
    c.header('Access-Control-Allow-Origin', '*');
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
    response?.headers.set('Access-Control-Allow-Origin', '*');
    return response ?? c.json({ error: 'Demo not found' }, 404);
  });
  if (dependencies.pakDist !== undefined) app.all('*', createStaticHandler(dependencies.pakDist));
  app.notFound((c) => c.json({ error: 'Not Found' }, 404));

  return app;
}
