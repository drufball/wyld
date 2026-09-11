import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  NewRetro,
  Retro,
  SleepCurrent,
  SleepOutcome,
  SleepPhase,
  SleepRun,
  type NewEvent,
  type SleepAlarm as SleepAlarmType,
} from '@wyld/shared';
import { z } from 'zod';

import type { AppDatabase } from './database.js';
import { events, retros, sleepRuns } from './schema.js';
import { formatIssues } from '@wyld/shared';

export type SleepConfig = {
  timeZone: string;
  goodnight: string;
  lastCall: string;
  lightsOn: string;
  enabled: boolean;
};
type StoreEvent = (event: NewEvent) => Promise<unknown>;
type Dependencies = {
  database: AppDatabase;
  now: () => Date;
  storeEvent: StoreEvent;
  config: SleepConfig;
};
const Limit = z.object({ limit: z.coerce.number().int().positive().max(100).default(20) });
const Goodnight = z.object({ trigger: z.literal('human').default('human') }).strict();
const PhasePost = z.object({ phase: SleepPhase, note: z.string().min(1).optional() }).strict();
const EndPost = z
  .object({ outcome: SleepOutcome, leftoversParked: z.array(z.string()).optional() })
  .strict();
const LIGHTS_ON_CATCHUP_WINDOW_MS = 2 * 60 * 60 * 1000;

const parts = (date: Date, timeZone: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
export const localDate = (date: Date, timeZone: string) => {
  const p = parts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
};
const wallInstant = (date: string, time: string, timeZone: string): Date => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(guess), timeZone);
    const represented = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
    );
    guess += target - represented;
  }
  return new Date(guess);
};
const addDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const nextAt = (now: Date, time: string, timeZone: string) => {
  const date = localDate(now, timeZone);
  let instant = wallInstant(date, time, timeZone);
  if (instant.getTime() < now.getTime()) instant = wallInstant(addDay(date), time, timeZone);
  return instant.toISOString();
};
const scheduleFor = (now: Date, config: SleepConfig) => ({
  goodnightAt: nextAt(now, config.goodnight, config.timeZone),
  lastCallAt: nextAt(now, config.lastCall, config.timeZone),
  lightsOnAt: nextAt(now, config.lightsOn, config.timeZone),
});
const parseRun = (row: typeof sleepRuns.$inferSelect) => SleepRun.parse(row);

export function createSleepService(dependencies: Dependencies) {
  const { database, now, storeEvent, config } = dependencies;
  const open = () => database.db.select().from(sleepRuns).where(isNull(sleepRuns.ended)).get();
  const alarm = async (row: typeof sleepRuns.$inferSelect, alarmName: SleepAlarmType) => {
    if (row.alarmsFired.includes(alarmName)) return parseRun(row);
    const alarmsFired = [...row.alarmsFired, alarmName];
    database.db.update(sleepRuns).set({ alarmsFired }).where(eq(sleepRuns.id, row.id)).run();
    await storeEvent({
      source: 'sleep',
      kind: 'sleep.alarm',
      payload: {
        runId: row.id,
        alarm: alarmName,
        trigger: row.trigger,
        lightsOnAt: nextAt(new Date(row.started), config.lightsOn, config.timeZone),
        openRun: true,
        summary:
          alarmName === 'goodnight'
            ? 'The factory started its night shift.'
            : alarmName === 'last_call'
              ? 'The factory reached last call.'
              : 'The lights came on for the morning.',
      },
    });
    return parseRun({ ...row, alarmsFired });
  };
  const start = async (trigger: 'human' | 'schedule') => {
    if (open() !== undefined) return undefined;
    const [row] = database.db
      .insert(sleepRuns)
      .values({
        started: now().toISOString(),
        trigger,
        phases: [],
        alarmsFired: [],
        leftoversParked: [],
      })
      .returning()
      .all();
    if (row === undefined) throw new Error('Sleep run insert did not return a row');
    return alarm(row, 'goodnight');
  };
  const phase = async (row: typeof sleepRuns.$inferSelect, value: z.infer<typeof PhasePost>) => {
    const entry = {
      phase: value.phase,
      at: now().toISOString(),
      ...(value.note === undefined ? {} : { note: value.note }),
    };
    const phases = [...row.phases, entry];
    database.db.update(sleepRuns).set({ phases }).where(eq(sleepRuns.id, row.id)).run();
    await storeEvent({
      source: 'sleep',
      kind: 'sleep.phase',
      payload: {
        runId: row.id,
        ...value,
        summary: `The night shift entered the ${value.phase} phase.`,
      },
    });
    return parseRun({ ...row, phases });
  };
  const end = async (
    row: typeof sleepRuns.$inferSelect,
    outcome: z.infer<typeof SleepOutcome>,
    leftovers?: string[],
  ) => {
    const at = now().toISOString();
    const phases = [...row.phases, { phase: 'ended' as const, at }];
    const update = {
      ended: at,
      outcome,
      phases,
      ...(leftovers === undefined ? {} : { leftoversParked: leftovers }),
    };
    database.db
      .update(sleepRuns)
      .set(update)
      .where(and(eq(sleepRuns.id, row.id), isNull(sleepRuns.ended)))
      .run();
    await storeEvent({
      source: 'sleep',
      kind: 'sleep.phase',
      payload: { runId: row.id, phase: 'ended', summary: 'The night shift ended.' },
    });
    return parseRun({ ...row, ...update });
  };
  return { open, alarm, start, phase, end };
}

export function createSleepRoutes(dependencies: Dependencies) {
  const app = new Hono();
  const { database, now, config } = dependencies;
  const service = createSleepService(dependencies);
  app.post('/sleep/goodnight', async (c) => {
    const parsed = Goodnight.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const run = await service.start(parsed.data.trigger);
    return run === undefined
      ? c.json({ error: 'A sleep run is already open' }, 409)
      : c.json(run, 201);
  });
  app.get('/sleep/current', (c) =>
    c.json(
      SleepCurrent.parse({
        run: service.open() === undefined ? null : parseRun(service.open()!),
        schedule: scheduleFor(now(), config),
      }),
    ),
  );
  app.get('/sleep/runs', (c) => {
    const parsed = Limit.safeParse(c.req.query());
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    return c.json(
      database.db
        .select()
        .from(sleepRuns)
        .orderBy(desc(sleepRuns.started))
        .limit(parsed.data.limit)
        .all()
        .map(parseRun),
    );
  });
  app.post('/sleep/:id/phase', async (c) => {
    const id = z.coerce.number().int().positive().safeParse(c.req.param('id'));
    const body = PhasePost.safeParse(await c.req.json().catch(() => undefined));
    if (!id.success) return c.json(formatIssues(id.error), 400);
    if (!body.success) return c.json(formatIssues(body.error), 400);
    const row = database.db.select().from(sleepRuns).where(eq(sleepRuns.id, id.data)).get();
    if (!row) return c.json({ error: 'Sleep run not found' }, 404);
    if (row.ended) return c.json({ error: 'Sleep run has ended' }, 409);
    return c.json(await service.phase(row, body.data));
  });
  app.post('/sleep/:id/end', async (c) => {
    const id = z.coerce.number().int().positive().safeParse(c.req.param('id'));
    const body = EndPost.safeParse(await c.req.json().catch(() => undefined));
    if (!id.success) return c.json(formatIssues(id.error), 400);
    if (!body.success) return c.json(formatIssues(body.error), 400);
    const row = database.db.select().from(sleepRuns).where(eq(sleepRuns.id, id.data)).get();
    if (!row) return c.json({ error: 'Sleep run not found' }, 404);
    if (row.ended) return c.json({ error: 'Sleep run has ended' }, 409);
    return c.json(await service.end(row, body.data.outcome, body.data.leftoversParked));
  });
  app.get('/retros', (c) => {
    const parsed = Limit.safeParse(c.req.query());
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    return c.json(
      database.db
        .select()
        .from(retros)
        .orderBy(desc(retros.date))
        .limit(parsed.data.limit)
        .all()
        .map((r) => Retro.parse(r)),
    );
  });
  app.get('/retros/:date', (c) => {
    const date = z.iso.date().safeParse(c.req.param('date'));
    if (!date.success) return c.json(formatIssues(date.error), 400);
    const row = database.db.select().from(retros).where(eq(retros.date, date.data)).get();
    return row ? c.json(Retro.parse(row)) : c.json({ error: 'Retro not found' }, 404);
  });
  app.put('/retros/:date', async (c) => {
    const date = z.iso.date().safeParse(c.req.param('date'));
    const body = NewRetro.safeParse(await c.req.json().catch(() => undefined));
    if (!date.success) return c.json(formatIssues(date.error), 400);
    if (!body.success) return c.json(formatIssues(body.error), 400);
    const timestamp = now().toISOString();
    const [row] = database.db
      .insert(retros)
      .values({
        date: date.data,
        ...body.data,
        generatedBy: 'planner',
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: retros.date,
        set: { ...body.data, generatedBy: 'planner', updatedAt: timestamp },
      })
      .returning()
      .all();
    if (!row) throw new Error('Retro upsert did not return a row');
    return c.json(Retro.parse(row));
  });
  return app;
}

type SchedulerDependencies = Dependencies & {
  setNextAction: (text: string, deepLink: string | null) => Promise<void>;
  setIntervalFn?: typeof setInterval;
};
export function createSleepScheduler(dependencies: SchedulerDependencies) {
  const service = createSleepService(dependencies);
  let timer: ReturnType<typeof setInterval> | undefined;
  const guard = async (row: typeof sleepRuns.$inferSelect) => {
    const current = dependencies.database.db
      .select()
      .from(sleepRuns)
      .where(eq(sleepRuns.id, row.id))
      .get();
    if (!current || current.ended) return;
    await service.end(
      current,
      current.phases.some(({ phase }) => phase === 'reset') ? 'clean' : 'timed_out',
    );
    const date = localDate(new Date(current.started), dependencies.config.timeZone);
    if (!dependencies.database.db.select().from(retros).where(eq(retros.date, date)).get()) {
      const start = wallInstant(date, '00:00', dependencies.config.timeZone).toISOString();
      const finish = wallInstant(addDay(date), '00:00', dependencies.config.timeZone).toISOString();
      const rows = dependencies.database.db
        .select()
        .from(events)
        .where(and(gte(events.ts, start), lt(events.ts, finish)))
        .all()
        .filter((event) => event.kind !== 'planner.tick');
      const shipped = new Set(
        rows
          .filter(
            (e) =>
              e.kind === 'planner.quest_updated' &&
              (e.payload as Record<string, unknown>)['status'] === 'done',
          )
          .map((e) => e.questId)
          .filter(Boolean),
      );
      const timestamp = dependencies.now().toISOString();
      dependencies.database.db
        .insert(retros)
        .values({
          date,
          summary: 'The night ended before the Planner wrote it up.',
          wins: [],
          misses: [],
          factoryImprovements: [],
          stats: {
            eventsTotal: rows.length,
            questsShipped: shipped.size,
            rumblesDecided: rows.filter((e) => e.kind === 'human.decision').length,
          },
          generatedBy: 'mechanical',
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .onConflictDoNothing()
        .run();
    }
    await dependencies.setNextAction('Good morning — nothing needs you yet', '/');
  };
  const tick = async () => {
    if (!dependencies.config.enabled) return;
    const currentNow = dependencies.now();
    let row = service.open();
    const p = parts(currentNow, dependencies.config.timeZone);
    const minute = `${p.hour}:${p.minute}`;
    const hadLights = row?.alarmsFired.includes('lights_on') ?? false;
    if (row && hadLights) {
      await guard(row);
      return;
    }
    if (!row && minute >= dependencies.config.goodnight) {
      const today = localDate(currentNow, dependencies.config.timeZone);
      const fired = dependencies.database.db
        .select()
        .from(sleepRuns)
        .all()
        .some((r) => localDate(new Date(r.started), dependencies.config.timeZone) === today);
      if (!fired) {
        await service.start('schedule');
        row = service.open();
      }
    }
    if (row) {
      const current = dependencies.database.db
        .select()
        .from(sleepRuns)
        .where(eq(sleepRuns.id, row.id))
        .get();
      if (
        current &&
        !current.alarmsFired.includes('last_call') &&
        currentNow >=
          new Date(
            nextAt(
              new Date(current.started),
              dependencies.config.lastCall,
              dependencies.config.timeZone,
            ),
          )
      ) {
        await service.alarm(current, 'last_call');
      }

      const afterLastCall = dependencies.database.db
        .select()
        .from(sleepRuns)
        .where(eq(sleepRuns.id, row.id))
        .get();
      if (
        afterLastCall &&
        !afterLastCall.alarmsFired.includes('lights_on') &&
        currentNow >=
          new Date(
            nextAt(
              new Date(afterLastCall.started),
              dependencies.config.lightsOn,
              dependencies.config.timeZone,
            ),
          )
      ) {
        await service.alarm(afterLastCall, 'lights_on');
      }
    }
    if (service.open() === undefined) {
      const date = localDate(currentNow, dependencies.config.timeZone);
      const lightsOn = wallInstant(
        date,
        dependencies.config.lightsOn,
        dependencies.config.timeZone,
      );
      const elapsed = currentNow.getTime() - lightsOn.getTime();
      if (elapsed >= 0 && elapsed < LIGHTS_ON_CATCHUP_WINDOW_MS) {
        const startOfDay = wallInstant(date, '00:00', dependencies.config.timeZone).toISOString();
        const alreadyFired = dependencies.database.db
          .select()
          .from(events)
          .where(and(eq(events.kind, 'sleep.alarm'), gte(events.ts, startOfDay)))
          .all()
          .some((event) => (event.payload as Record<string, unknown>)['alarm'] === 'lights_on');
        if (!alreadyFired) {
          const latestRun = dependencies.database.db
            .select()
            .from(sleepRuns)
            .orderBy(desc(sleepRuns.started))
            .get();
          await dependencies.storeEvent({
            source: 'sleep',
            kind: 'sleep.alarm',
            payload: {
              runId: latestRun?.id ?? null,
              alarm: 'lights_on',
              trigger: 'schedule',
              lightsOnAt: lightsOn.toISOString(),
              openRun: false,
              summary: 'The lights came on for the morning.',
            },
          });
        }
      }
    }
  };
  return {
    tick,
    start: () => {
      if (!dependencies.config.enabled || timer) return;
      timer = (dependencies.setIntervalFn ?? setInterval)(() => void tick(), 30_000);
      timer.unref?.();
    },
    stop: () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}
