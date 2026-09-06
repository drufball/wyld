import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { PauseLane, type NewEvent } from '@wyld/shared';
import { z } from 'zod';

import type { AppDatabase } from './database.js';
import type { WakePauseNotifier } from './forwarder.js';
import type { Notifier } from './notify.js';
import { formatIssues } from './quests.js';
import { writeRumble } from './rumbles.js';
import { pauses, rumbles } from './schema.js';

const PausePost = z
  .object({
    reason: z.string().min(1).max(280),
    lane: PauseLane.default('all'),
    fix: z.string().min(1).max(280).optional(),
  })
  .strict();

const ResumePost = z.object({ lane: PauseLane.optional() }).strict();

type Dependencies = {
  database: AppDatabase;
  now: () => Date;
  storeEvent: (event: NewEvent) => Promise<unknown>;
  notify: Notifier;
  pakPublicUrl?: string;
  notifyWake?: WakePauseNotifier;
};

export function createPauseService({
  database,
  now,
  storeEvent,
  notifyWake = () => undefined,
}: Omit<Dependencies, 'notify' | 'pakPublicUrl'>) {
  return async (lane?: string, options: { decideRumble?: boolean } = {}) => {
    const active = database.db
      .select()
      .from(pauses)
      .where(
        lane === undefined
          ? isNull(pauses.resolvedAt)
          : and(isNull(pauses.resolvedAt), eq(pauses.lane, lane)),
      )
      .all();
    for (const pause of active) {
      const resolvedAt = now().toISOString();
      database.db.update(pauses).set({ resolvedAt }).where(eq(pauses.id, pause.id)).run();
      if (options.decideRumble !== false && pause.rumbleId !== null) {
        database.db
          .update(rumbles)
          .set({ chosen: 'Resume', chosenAt: resolvedAt })
          .where(eq(rumbles.id, pause.rumbleId))
          .run();
      }
      await storeEvent({
        source: 'planner',
        kind: 'system.resumed',
        payload: { summary: `The factory resumed (${pause.lane}).`, lane: pause.lane },
      });
    }
    if (
      active.length > 0 &&
      database.db.select().from(pauses).where(isNull(pauses.resolvedAt)).get() === undefined
    ) {
      notifyWake(null);
    }
    return active.length;
  };
}

export function createPauseRoutes(dependencies: Dependencies) {
  const {
    database,
    now,
    storeEvent,
    notify,
    pakPublicUrl,
    notifyWake = () => undefined,
  } = dependencies;
  const app = new Hono();
  const resumePause = createPauseService(dependencies);

  app.post('/pause', async (c) => {
    const parsed = PausePost.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const { lane, reason, fix } = parsed.data;
    const existing = database.db
      .select()
      .from(pauses)
      .where(and(eq(pauses.lane, lane), isNull(pauses.resolvedAt)))
      .get();
    if (existing !== undefined) return c.json(existing, 200);

    const [pause] = database.db
      .insert(pauses)
      .values({ lane, reason, fix, since: now().toISOString() })
      .returning()
      .all();
    if (pause === undefined) throw new Error('Pause insert did not return a row');
    const rumbleId = `outage-${lane}`;
    writeRumble(database, now, {
      id: rumbleId,
      title: lane === 'all' ? 'The factory paused' : `The factory paused (${lane})`,
      context: fix === undefined ? reason : `${reason}. ${fix}.`,
      options: ['Resume'],
      kind: 'outage',
      blockingQuestIds: [],
    });
    database.db
      .update(rumbles)
      .set({ chosen: null, chosenAt: null })
      .where(eq(rumbles.id, rumbleId))
      .run();
    database.db.update(pauses).set({ rumbleId }).where(eq(pauses.id, pause.id)).run();
    const result = { ...pause, rumbleId };
    await storeEvent({
      source: 'planner',
      kind: 'system.paused',
      payload: {
        summary: lane === 'all' ? 'The factory paused.' : `The factory paused (${lane}).`,
        reason,
        lane,
        ...(fix === undefined ? {} : { fix }),
      },
    });
    notify('The factory paused', reason, {
      tags: ['warning'],
      ...(pakPublicUrl === undefined ? {} : { click: new URL('/rumble', pakPublicUrl).toString() }),
    });
    notifyWake(pause.since);
    return c.json(result, 201);
  });

  app.post('/resume', async (c) => {
    const parsed = ResumePost.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    return c.json({ resumed: await resumePause(parsed.data.lane) });
  });

  return app;
}
