import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Event, HealthSnapshot, Rumble } from '@wyld/shared';

import { createApp } from './app.js';
import { mechanicalDigest } from './catchup.js';
import { openDatabase, type AppDatabase } from './database.js';
import { pauses } from './schema.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

describe('pause routes', () => {
  let directory: string;
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;
  let fetcher: ReturnType<typeof vi.fn<typeof globalThis.fetch>>;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-pauses-'));
    database = openDatabase(path.join(directory, 'pak.sqlite'), migrations);
    fetcher = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 200 }));
    app = createApp({
      database,
      demosDir: path.join(directory, 'demos'),
      feedbackDir: path.join(directory, 'feedback'),
      now: () => new Date('2026-09-06T12:00:00.000Z'),
      ntfyUrl: 'https://ntfy.example',
      fetch: fetcher,
      logger: () => undefined,
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

  it('opens an idempotent pause with one event, rumble, push, and snapshot state', async () => {
    const body = { reason: 'Codex quota hit', fix: 'Wait for the quota window to roll over' };
    const first = await post('/api/pause', body);
    const firstPause = await first.json();
    expect(first.status).toBe(201);
    const second = await post('/api/pause', body);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(firstPause);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).not.toHaveProperty('click');

    const events = Event.array().parse(await (await app.request('/api/events')).json());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'system.paused',
      payload: { reason: body.reason, lane: 'all', fix: body.fix },
    });
    expect(mechanicalDigest({ events, quests: [] }).fyi).toContain(
      'The factory paused — Codex quota hit.',
    );
    const rumbles = Rumble.array().parse(
      await (await app.request('/api/rumbles?status=open')).json(),
    );
    expect(rumbles).toEqual([
      expect.objectContaining({
        id: 'outage-all',
        title: 'The factory paused',
        context: expect.stringContaining(body.fix),
        options: ['Resume'],
        kind: 'outage',
      }),
    ]);
    const snapshot = HealthSnapshot.parse(await (await app.request('/api/health/snapshot')).json());
    expect(snapshot.paused).toMatchObject({ lane: 'all', reason: body.reason, fix: body.fix });
  });

  it('uses the configured public Pak URL for notification tap-through', async () => {
    app = createApp({
      database,
      demosDir: path.join(directory, 'demos'),
      feedbackDir: path.join(directory, 'feedback'),
      now: () => new Date('2026-09-06T12:00:00.000Z'),
      ntfyUrl: 'https://ntfy.example',
      pakPublicUrl: 'https://pak.example/base/',
      fetch: fetcher,
      logger: () => undefined,
    });

    await post('/api/pause', { reason: 'Codex quota hit' });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toMatchObject({
      click: 'https://pak.example/rumble',
    });
  });

  it('resumes lanes independently and deciding an outage also resumes it', async () => {
    await post('/api/pause', { reason: 'Codex unavailable', lane: 'codex' });
    await post('/api/pause', { reason: 'GitHub unavailable', lane: 'github' });
    expect(await (await post('/api/resume', { lane: 'codex' })).json()).toEqual({ resumed: 1 });
    expect(
      database.db
        .select()
        .from(pauses)
        .all()
        .filter((row) => row.resolvedAt === null)
        .map((row) => row.lane),
    ).toEqual(['github']);

    await post('/api/rumbles/outage-github/decide', { chosen: 'Resume' });
    expect(await (await post('/api/resume', {})).json()).toEqual({ resumed: 0 });
    expect(
      database.db
        .select()
        .from(pauses)
        .all()
        .every((row) => row.resolvedAt !== null),
    ).toBe(true);
    const events = Event.array().parse(await (await app.request('/api/events')).json());
    expect(events.filter((event) => event.kind === 'system.paused')).toHaveLength(2);
    expect(events.filter((event) => event.kind === 'system.resumed')).toHaveLength(2);
    expect(events.filter((event) => event.kind === 'human.decision')).toHaveLength(1);
    expect(
      HealthSnapshot.parse(await (await app.request('/api/health/snapshot')).json()),
    ).not.toHaveProperty('paused');
  });
});
