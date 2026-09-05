import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
    const events = Event.array().parse(await (await app.request('/api/events')).json());
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
