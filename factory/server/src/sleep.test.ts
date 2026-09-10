import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Retro, SleepRun, type NewEvent } from '@wyld/shared';
import { createApp } from './app.js';
import { openDatabase, type AppDatabase } from './database.js';
import { events, presence, retros, sleepRuns } from './schema.js';
import { createSleepScheduler, createSleepService, type SleepConfig } from './sleep.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
describe('sleep routes', () => {
  let directory: string;
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-sleep-'));
    database = openDatabase(path.join(directory, 'db.sqlite'), migrations);
    app = createApp({
      database,
      demosDir: directory,
      feedbackDir: directory,
      now: () => new Date('2026-09-06T23:00:00.000Z'),
    });
  });
  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const send = (url: string, method: string, body: unknown) =>
    app.request(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  it('creates, progresses, ends, and lists a run', async () => {
    const created = await send('/api/sleep/goodnight', 'POST', {});
    expect(created.status).toBe(201);
    expect(SleepRun.parse(await created.json()).alarmsFired).toEqual(['goodnight']);
    expect((await send('/api/sleep/goodnight', 'POST', {})).status).toBe(409);
    expect(
      (await send('/api/sleep/1/phase', 'POST', { phase: 'drain', note: 'Working' })).status,
    ).toBe(200);
    const ended = await send('/api/sleep/1/end', 'POST', { outcome: 'clean' });
    expect(SleepRun.parse(await ended.json()).phases.at(-1)?.phase).toBe('ended');
    expect(
      SleepRun.array().parse(await (await app.request('/api/sleep/runs')).json()),
    ).toHaveLength(1);
    expect((await send('/api/sleep/999/phase', 'POST', { phase: 'drain' })).status).toBe(404);
    expect((await send('/api/sleep/1/phase', 'POST', { phase: 'drain' })).status).toBe(409);
    expect((await send('/api/sleep/999/end', 'POST', { outcome: 'clean' })).status).toBe(404);
    expect((await send('/api/sleep/1/end', 'POST', { outcome: 'clean' })).status).toBe(409);
  });
  it('validates and upserts retros as planner output', async () => {
    expect((await app.request('/api/retros/not-a-date')).status).toBe(400);
    const response = await send('/api/retros/2026-09-06', 'PUT', { summary: 'Quiet night' });
    expect(Retro.parse(await response.json())).toMatchObject({ generatedBy: 'planner', wins: [] });
    expect(Retro.array().parse(await (await app.request('/api/retros')).json())).toHaveLength(1);
  });

  it('replaces a mechanical retro as planner output without changing its creation time', async () => {
    database.db
      .insert(retros)
      .values({
        date: '2026-09-06',
        summary: 'Automatic summary',
        wins: [],
        misses: [],
        factoryImprovements: [],
        stats: { eventsTotal: 1 },
        generatedBy: 'mechanical',
        createdAt: '2026-09-06T08:00:00.000Z',
        updatedAt: '2026-09-06T08:00:00.000Z',
      })
      .run();

    const response = await send('/api/retros/2026-09-06', 'PUT', { summary: 'Planner summary' });
    expect(Retro.parse(await response.json())).toMatchObject({
      summary: 'Planner summary',
      generatedBy: 'planner',
      createdAt: '2026-09-06T08:00:00.000Z',
      updatedAt: '2026-09-06T23:00:00.000Z',
    });
  });
});

describe('sleep scheduler', () => {
  let directory: string;
  let database: AppDatabase;
  let now: Date;
  const config: SleepConfig = {
    timeZone: 'UTC',
    goodnight: '23:00',
    lastCall: '07:15',
    lightsOn: '08:00',
    enabled: true,
  };

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-scheduler-'));
    database = openDatabase(path.join(directory, 'db.sqlite'), migrations);
    now = new Date('2026-09-06T23:01:00.000Z');
  });
  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const storeEvent = async (event: NewEvent) => {
    const [row] = database.db
      .insert(events)
      .values({ ...event, ts: now.toISOString() })
      .returning()
      .all();
    return row;
  };
  const scheduler = (overrides: Partial<SleepConfig> = {}) =>
    createSleepScheduler({
      database,
      now: () => now,
      storeEvent,
      config: { ...config, ...overrides },
      setNextAction: async (text, deepLink) => {
        database.db.update(presence).set({ nextActionText: text, nextActionLink: deepLink }).run();
        await storeEvent({ source: 'planner', kind: 'planner.next_action', payload: { text } });
      },
      setIntervalFn: (() => ({ unref: () => undefined })) as unknown as typeof setInterval,
    });
  const runs = () => database.db.select().from(sleepRuns).all();
  const storedEvents = () => database.db.select().from(events).all();

  it('fires scheduled goodnight only once per local calendar day', async () => {
    const subject = scheduler();
    await subject.tick();
    expect(runs()).toHaveLength(1);

    now = new Date('2026-09-06T23:45:00.000Z');
    await subject.tick();
    expect(runs()).toHaveLength(1);
    expect(storedEvents().filter((event) => event.kind === 'sleep.alarm')).toHaveLength(1);
  });

  it('does not schedule goodnight while another run is open', async () => {
    await createSleepService({ database, now: () => now, storeEvent, config }).start('human');
    await scheduler().tick();
    expect(runs()).toHaveLength(1);
  });

  it('fires last call and lights on once per open run and records both alarms', async () => {
    const subject = scheduler();
    await subject.tick();
    now = new Date('2026-09-07T08:01:00.000Z');
    await subject.tick();

    expect(runs()[0]?.ended).toBeNull();
    expect(runs()[0]?.alarmsFired).toEqual(['goodnight', 'last_call', 'lights_on']);
    expect(storedEvents().filter((event) => event.kind === 'sleep.alarm')).toHaveLength(3);
  });

  it('does not fire last call without an open run', async () => {
    now = new Date('2026-09-06T07:16:00.000Z');
    await scheduler().tick();
    expect(storedEvents()).toEqual([]);
  });

  it('fires lights on at its scheduled time when no run is open', async () => {
    now = new Date('2026-09-05T23:00:00.000Z');
    const ended = await createSleepService({ database, now: () => now, storeEvent, config }).start(
      'human',
    );
    await createSleepService({ database, now: () => now, storeEvent, config }).end(ended!, 'clean');
    const alarmsBefore = runs()[0]?.alarmsFired;

    now = new Date('2026-09-06T08:00:00.000Z');
    await scheduler().tick();

    expect(storedEvents().at(-1)).toMatchObject({
      source: 'sleep',
      kind: 'sleep.alarm',
      payload: {
        runId: 1,
        alarm: 'lights_on',
        trigger: 'schedule',
        lightsOnAt: '2026-09-06T08:00:00.000Z',
        openRun: false,
      },
    });
    expect(runs()[0]?.alarmsFired).toEqual(alarmsBefore);
  });

  it('fires the run-less lights on only once per local day', async () => {
    now = new Date('2026-09-06T08:01:00.000Z');
    await scheduler().tick();
    await scheduler().tick();
    expect(storedEvents().filter(({ kind }) => kind === 'sleep.alarm')).toHaveLength(1);
  });

  it('does not fire a run-less lights on hours after the scheduled time', async () => {
    now = new Date('2026-09-06T10:00:00.000Z');
    await scheduler().tick();
    expect(storedEvents()).toEqual([]);
  });

  it('is idempotent after a process restart', async () => {
    const first = scheduler();
    await first.tick();
    now = new Date('2026-09-07T08:01:00.000Z');
    await first.tick();
    await first.tick();
    const before = { runs: runs().length, events: storedEvents().length };

    const restarted = scheduler();
    await restarted.tick();
    expect({ runs: runs().length, events: storedEvents().length }).toEqual(before);
    expect(storedEvents().filter((event) => event.kind === 'sleep.alarm')).toHaveLength(3);
  });

  it('does nothing when scheduling is disabled', async () => {
    await scheduler({ enabled: false }).tick();
    expect(runs()).toEqual([]);
    expect(storedEvents()).toEqual([]);
  });

  it('guards on the tick after lights on and creates one correctly scoped mechanical retro', async () => {
    now = new Date('2026-09-06T01:00:00.000Z');
    await createSleepService({ database, now: () => now, storeEvent, config }).start('human');
    database.db
      .insert(events)
      .values([
        {
          ts: '2026-09-06T02:00:00.000Z',
          source: 'planner',
          kind: 'planner.quest_updated',
          questId: 'inside',
          payload: { status: 'done' },
        },
        {
          ts: '2026-09-06T03:00:00.000Z',
          source: 'human',
          kind: 'human.decision',
          payload: {},
        },
        {
          ts: '2026-09-05T02:00:00.000Z',
          source: 'planner',
          kind: 'planner.quest_updated',
          questId: 'outside',
          payload: { status: 'done' },
        },
        {
          ts: '2026-09-07T03:00:00.000Z',
          source: 'human',
          kind: 'human.decision',
          payload: {},
        },
      ])
      .run();
    const subject = scheduler();
    now = new Date('2026-09-06T08:01:00.000Z');
    await subject.tick();
    expect(runs()[0]?.ended).toBeNull();

    now = new Date('2026-09-06T08:02:00.000Z');
    await subject.tick();
    await subject.tick();
    expect(runs()[0]).toMatchObject({ outcome: 'timed_out' });
    const retro = database.db.select().from(retros).get();
    expect(retro).toMatchObject({
      date: '2026-09-06',
      generatedBy: 'mechanical',
      stats: { eventsTotal: 6, questsShipped: 1, rumblesDecided: 1 },
    });
    expect(database.db.select().from(retros).all()).toHaveLength(1);
    expect(database.db.select().from(presence).get()).toMatchObject({
      nextActionText: 'Good morning — nothing needs you yet',
      nextActionLink: '/',
    });
    expect(storedEvents().filter((event) => event.kind === 'sleep.phase')).toHaveLength(1);
  });

  it('ends a run that never reached reset as timed out', async () => {
    now = new Date('2026-09-06T01:00:00.000Z');
    await createSleepService({ database, now: () => now, storeEvent, config }).start('human');
    const subject = scheduler();
    now = new Date('2026-09-06T08:01:00.000Z');
    await subject.tick();
    await subject.tick();
    expect(runs()[0]?.outcome).toBe('timed_out');
  });

  it('ends a run that reached reset as clean', async () => {
    now = new Date('2026-09-06T01:00:00.000Z');
    const service = createSleepService({ database, now: () => now, storeEvent, config });
    const run = await service.start('human');
    await service.phase(run!, { phase: 'reset' });
    const subject = scheduler();
    now = new Date('2026-09-06T08:01:00.000Z');
    await subject.tick();
    await subject.tick();
    expect(runs()[0]?.outcome).toBe('clean');
  });

  it('leaves an existing retro untouched when the lights-on guard runs', async () => {
    await createSleepService({ database, now: () => now, storeEvent, config }).start('human');
    database.db
      .insert(retros)
      .values({
        date: '2026-09-06',
        summary: 'Planner-owned',
        wins: ['kept'],
        misses: [],
        factoryImprovements: [],
        stats: {},
        generatedBy: 'planner',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .run();
    const subject = scheduler();
    now = new Date('2026-09-07T08:01:00.000Z');
    await subject.tick();
    await subject.tick();
    expect(database.db.select().from(retros).get()).toMatchObject({
      summary: 'Planner-owned',
      wins: ['kept'],
      generatedBy: 'planner',
    });
  });
});
