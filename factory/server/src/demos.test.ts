import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Demo, Event, Feedback } from '@wyld/shared';
import { eq } from 'drizzle-orm';

import { createApp } from './app.js';
import type { DemoBuilder } from './builder.js';
import { openDatabase, type AppDatabase } from './database.js';
import { demos, quests, worlds } from './schema.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

describe('demo and feedback routes', () => {
  let directory: string;
  let database: AppDatabase;
  let clock: Date;
  let building: Set<string>;
  let build: ReturnType<typeof vi.fn<DemoBuilder['build']>>;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-demos-'));
    database = openDatabase(path.join(directory, 'pak.sqlite'), migrations);
    clock = new Date('2026-09-05T12:00:00.000Z');
    building = new Set();
    build = vi.fn(async () => ({ ok: true as const }));
    app = createApp({
      database,
      now: () => clock,
      logger: () => undefined,
      demosDir: path.join(directory, 'demos'),
      feedbackDir: path.join(directory, 'feedback'),
      builder: { build, isBuilding: (id) => building.has(id) },
    });
  });

  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const post = (url: string, body: unknown) =>
    app.request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('lists demos, sorts main first, and consistently orders unbuilt demos', async () => {
    build.mockImplementation(() => new Promise(() => undefined));
    expect(await (await app.request('/api/demos')).json()).toEqual([]);
    for (const id of ['zeta', 'main', 'alpha']) {
      expect((await post('/api/demos', { id, ref: id })).status).toBe(201);
    }
    await vi.waitFor(async () => {
      const rows = Demo.array().parse(await (await app.request('/api/demos')).json());
      expect(rows.map(({ id }) => id)).toEqual(['main', 'alpha', 'zeta']);
      expect(rows[0]).toMatchObject({
        kind: 'disc',
        summary: null,
        steps: [],
        seeded: [],
        deepLink: null,
        url: '/play/main/',
      });
    });
  });

  it('upserts demos and defaults their title from the quest', async () => {
    database.db
      .insert(worlds)
      .values({ id: 'factory', name: 'Factory', kind: 'factory', order: 0, icon: 'gear' })
      .run();
    database.db
      .insert(quests)
      .values({
        id: 'quest-one',
        worldId: 'factory',
        title: 'Quest title',
        pitch: 'Ship it',
        status: 'building',
        sinceYouLooked: '',
        lastNote: '',
      })
      .run();
    expect(
      (await post('/api/demos', { id: 'preview', ref: 'one', questId: 'quest-one' })).status,
    ).toBe(201);
    expect(
      (await post('/api/demos', { id: 'preview', ref: 'two', questId: 'quest-one' })).status,
    ).toBe(201);
    const row = database.db.select().from(demos).where(eq(demos.id, 'preview')).get();
    expect(row).toMatchObject({ title: 'Quest title', ref: 'two', questId: 'quest-one' });
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('registers and replaces live demo cards without building them', async () => {
    const first = await post('/api/demos', {
      id: 'try-card',
      ref: 'abc123',
      kind: 'live',
      title: 'First title',
      summary: 'A useful screen.',
      steps: ['Open it', 'Try it'],
      seeded: ['Example quest'],
      deepLink: '/sleep',
    });
    expect(first.status).toBe(201);
    expect(Demo.parse(await first.json())).toMatchObject({
      kind: 'live',
      status: 'ready',
      builtAt: clock.toISOString(),
      error: null,
      url: '/sleep',
    });
    expect(build).not.toHaveBeenCalled();

    clock = new Date('2026-09-05T13:00:00.000Z');
    const second = await post('/api/demos', {
      id: 'try-card',
      ref: 'main',
      kind: 'live',
      title: 'Updated title',
    });
    expect(second.status).toBe(201);
    expect(Demo.parse(await second.json())).toMatchObject({
      ref: 'main',
      title: 'Updated title',
      summary: null,
      steps: [],
      seeded: [],
      deepLink: null,
      url: '/',
      builtAt: clock.toISOString(),
    });
    expect(database.db.select().from(demos).all()).toHaveLength(1);
    expect(build).not.toHaveBeenCalled();

    const rebuild = await post('/api/demos/build', { id: 'try-card' });
    expect(rebuild.status).toBe(400);
    expect(await rebuild.json()).toEqual({ error: 'Live demos are not built' });
    expect(build).not.toHaveBeenCalled();
  });

  it('builds and rebuilds Pak demos and composes their deep links', async () => {
    const branch = await post('/api/demos', {
      id: 'branch-pak',
      ref: 'feature/pak',
      kind: 'pak',
      summary: 'Try the branch.',
      steps: ['Open Sleep.'],
      deepLink: '/sleep',
    });
    expect(branch.status).toBe(201);
    expect(Demo.parse(await branch.json())).toMatchObject({
      kind: 'pak',
      status: 'building',
      url: '/play/branch-pak/sleep',
    });
    expect(build).toHaveBeenCalledWith('branch-pak', 'feature/pak', 'pak');

    await post('/api/demos', {
      id: 'branch-root',
      ref: 'feature/root',
      kind: 'pak',
      summary: 'Try the root.',
      steps: ['Open it.'],
    });
    expect(
      Demo.array()
        .parse(await (await app.request('/api/demos')).json())
        .find((item) => item.id === 'branch-root')?.url,
    ).toBe('/play/branch-root/');

    const rebuild = await post('/api/demos/build', { id: 'branch-pak' });
    expect(rebuild.status).toBe(202);
    expect(build).toHaveBeenLastCalledWith('branch-pak', 'feature/pak', 'pak');
  });

  it('accepts feedback on a live demo and stores the human feedback event', async () => {
    await post('/api/demos', { id: 'live-card', ref: 'main', kind: 'live' });
    const response = await post('/api/feedback', { demoId: 'live-card', text: 'Looks good' });
    expect(response.status).toBe(201);
    const events = Event.array()
      .parse(await (await app.request('/api/events')).json())
      .filter(({ kind }) => kind === 'human.feedback');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'human.feedback',
      payload: { demoId: 'live-card', text: 'Looks good' },
    });
  });

  it('builds main on the fly, rejects unknown demos, and avoids a second active build', async () => {
    expect((await post('/api/demos/build', {})).status).toBe(202);
    expect(build).toHaveBeenCalledWith('main', 'main');
    expect((await post('/api/demos/build', { id: 'missing' })).status).toBe(404);

    building.add('main');
    expect((await post('/api/demos/build', { id: 'main' })).status).toBe(202);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('validates feedback before storing it', async () => {
    expect((await post('/api/feedback', { demoId: 'missing', text: 'No demo' })).status).toBe(404);
    await post('/api/demos', { id: 'main', ref: 'main' });
    expect(
      (
        await post('/api/feedback', {
          demoId: 'main',
          text: 'Bad image',
          screenshot: 'data:image/png;base64,not base64!',
        })
      ).status,
    ).toBe(400);
    const oversized = Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64');
    expect(
      (
        await post('/api/feedback', {
          demoId: 'main',
          text: 'Too large',
          screenshot: `data:image/png;base64,${oversized}`,
        })
      ).status,
    ).toBe(400);
    expect(fs.existsSync(path.join(directory, 'feedback'))).toBe(false);
  });

  it('writes one screenshot and emits one complete human feedback event', async () => {
    await post('/api/demos', { id: 'main', ref: 'main', title: 'Current game' });
    const response = await post('/api/feedback', {
      demoId: 'main',
      text: 'More trees',
      state: { camera: 'north' },
      screenshot: `data:image/png;base64,${Buffer.from('png bytes').toString('base64')}`,
    });
    expect(response.status).toBe(201);
    const stored = Feedback.parse(await response.json());
    expect(stored.hasScreenshot).toBe(true);
    const files = fs.readdirSync(path.join(directory, 'feedback'));
    expect(files).toEqual([`${stored.id}.png`]);
    expect(await (await app.request(`/api/feedback/${stored.id}/screenshot`)).text()).toBe(
      'png bytes',
    );
    const events = Event.array()
      .parse(await (await app.request('/api/events')).json())
      .filter(({ kind }) => kind === 'human.feedback');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source: 'human',
      kind: 'human.feedback',
      payload: {
        text: 'More trees',
        demo: 'Current game',
        demoId: 'main',
        feedbackId: stored.id,
        hasScreenshot: true,
        state: { camera: 'north' },
      },
    });
  });

  it('rejects invalid slugs on every demo and feedback route that accepts one', async () => {
    expect((await post('/api/demos', { id: '../bad', ref: 'main' })).status).toBe(400);
    expect((await post('/api/demos', { id: 'bad-ref', ref: '--upload-pack=evil' })).status).toBe(
      400,
    );
    expect((await post('/api/demos/build', { id: '../bad' })).status).toBe(400);
    expect((await app.request('/api/feedback?demo=../bad')).status).toBe(400);
    expect((await post('/api/feedback', { demoId: '../bad', text: 'bad' })).status).toBe(400);
  });
});

describe('demo migration', () => {
  it('backfills existing demos without changing their original fields', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`CREATE TABLE demos (
      id text PRIMARY KEY, quest_id text, title text NOT NULL, ref text NOT NULL,
      status text NOT NULL, built_at text, error text
    )`);
    sqlite
      .prepare('INSERT INTO demos VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('old-demo', 'quest-one', 'Old title', 'old-ref', 'ready', '2026-09-01T00:00:00Z', null);
    const migration = fs.readFileSync(path.join(migrations, '0012_greedy_miracleman.sql'), 'utf8');
    for (const statement of migration.split('--> statement-breakpoint')) sqlite.exec(statement);
    expect(sqlite.prepare('SELECT * FROM demos').get()).toEqual({
      id: 'old-demo',
      quest_id: 'quest-one',
      title: 'Old title',
      ref: 'old-ref',
      status: 'ready',
      built_at: '2026-09-01T00:00:00Z',
      error: null,
      kind: 'disc',
      summary: null,
      steps: null,
      seeded: null,
      deep_link: null,
    });
    sqlite.close();
  });
});
