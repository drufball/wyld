import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Event, Presence } from '@wyld/shared';
import { z } from 'zod';

import { createApp } from './app.js';
import { openDatabase, type AppDatabase } from './database.js';

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
const silentLogger = () => undefined;

describe('Pak server', () => {
  let directory: string;
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-server-'));
    database = openDatabase(path.join(directory, 'pak.sqlite'), migrationsFolder);
    app = createApp({ database, logger: silentLogger });
  });

  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  async function postEvent(kind: 'human.intent' | 'human.feedback', text: string) {
    return app.request('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'human', kind, payload: { text } }),
    });
  }

  it('stores a server-identified and timestamped event', async () => {
    const response = await postEvent('human.intent', 'hello');
    expect(response.status).toBe(201);
    const stored = Event.parse(await response.json());
    expect(stored).toMatchObject({ id: 1, source: 'human', kind: 'human.intent' });
    expect(stored.ts).toEqual(expect.any(String));

    const events = z.array(Event).parse(await (await app.request('/api/events')).json());
    expect(events).toEqual([stored]);
  });

  it('pages events after since in ascending order and respects limit', async () => {
    await postEvent('human.intent', 'one');
    await postEvent('human.feedback', 'two');
    await postEvent('human.intent', 'three');

    const events = z
      .array(Event)
      .parse(await (await app.request('/api/events?since=1&limit=1')).json());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: 2, payload: { text: 'two' } });
  });

  it('reports offending fields for an invalid body', async () => {
    const response = await app.request('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'intruder', kind: 'human.intent', payload: {} }),
    });
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain('source');
  });

  it('fans new events out to SSE subscribers', async () => {
    const controller = new AbortController();
    const response = await app.request('/api/events/stream', { signal: controller.signal });
    const reader = response.body!.getReader();
    await postEvent('human.intent', 'live');
    const chunk = await reader.read();
    controller.abort();
    const frame = new TextDecoder().decode(chunk.value);
    expect(frame).toContain('id: 1');
    expect(frame).toContain('"text":"live"');
  });

  it('replays missed SSE events after Last-Event-ID', async () => {
    await postEvent('human.intent', 'already seen');
    await postEvent('human.feedback', 'missed');
    const controller = new AbortController();
    const response = await app.request('/api/events/stream', {
      headers: { 'Last-Event-ID': '1' },
      signal: controller.signal,
    });
    const reader = response.body!.getReader();
    const chunk = await reader.read();
    controller.abort();
    const frame = new TextDecoder().decode(chunk.value);
    expect(frame).toContain('id: 2');
    expect(frame).toContain('"text":"missed"');
    expect(frame).not.toContain('already seen');
  });

  it('updates presence and records human.seen', async () => {
    const before = Presence.parse(await (await app.request('/api/presence')).json());
    const response = await app.request('/api/presence/seen', { method: 'POST' });
    expect(response.status).toBe(200);
    const after = Presence.parse(await response.json());
    expect(Date.parse(after.lastSeenAt)).toBeGreaterThanOrEqual(Date.parse(before.lastSeenAt));
    const events = z.array(Event).parse(await (await app.request('/api/events')).json());
    expect(events).toMatchObject([{ source: 'human', kind: 'human.seen' }]);
  });

  it('checks database health', async () => {
    const health = await (await app.request('/api/health')).json();
    expect(health).toMatchObject({ ok: true, db: 'ok', version: '0.0.0' });
  });
});
