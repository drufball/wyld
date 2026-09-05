import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('starts with no next action', async () => {
    const current = Presence.parse(await (await app.request('/api/presence')).json());
    expect(current.nextAction).toBeNull();
  });

  it('updates the next action and records a planner event', async () => {
    const response = await app.request('/api/presence/next-action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Try the demo', deepLink: '/demos' }),
    });
    expect(response.status).toBe(200);
    const updated = Presence.parse(await response.json());
    expect(updated.nextAction).toEqual({ text: 'Try the demo', deepLink: '/demos' });
    expect(Presence.parse(await (await app.request('/api/presence')).json())).toEqual(updated);
    const stored = z.array(Event).parse(await (await app.request('/api/events')).json());
    expect(stored).toMatchObject([
      {
        source: 'planner',
        kind: 'planner.next_action',
        payload: { text: 'Try the demo', deepLink: '/demos' },
      },
    ]);
  });

  it.each([{}, { text: '' }, { text: 'x', deepLink: 'https://example.com' }])(
    'rejects invalid next action %j',
    async (body) => {
      const response = await app.request('/api/presence/next-action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: 'Invalid request' });
    },
  );

  it('checks database health', async () => {
    const health = await (await app.request('/api/health')).json();
    expect(health).toMatchObject({ ok: true, db: 'ok', version: '0.0.0' });
  });

  it('keeps APIs available when the Pak build is absent', async () => {
    const appWithStatic = createApp({
      database,
      logger: silentLogger,
      pakDist: path.join(directory, 'missing-pak'),
    });
    expect((await appWithStatic.request('/api/health')).status).toBe(200);
    const unknownApi = await appWithStatic.request('/api/nope');
    expect(unknownApi.status).toBe(404);
    expect(await unknownApi.json()).toEqual({ error: 'Not Found' });
    const root = await appWithStatic.request('/');
    expect(root.status).toBe(404);
    expect(await root.json()).toEqual({
      error: 'Pak build not found',
      hint: 'pnpm --filter @wyld/pak build',
    });
  });

  it('forwards full human events with the Wake secret but ignores seen events', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    app = createApp({
      database,
      logger: silentLogger,
      wakeUrl: 'http://localhost:8788/something',
      wakeSecret: 'shared-secret',
      fetch: fetcher,
    });
    const response = await postEvent('human.intent', 'wake up');
    const event = await response.json();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8788/event',
      expect.objectContaining({
        headers: {
          'content-type': 'application/json',
          'X-Wake-Secret': 'shared-secret',
        },
        body: JSON.stringify(event),
      }),
    );
    await app.request('/api/presence/seen', { method: 'POST' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('does not delay or fail event ingestion when Wake is unreachable', async () => {
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    app = createApp({
      database,
      logger: silentLogger,
      wakeUrl: 'http://unreachable.invalid',
      wakeSecret: 'shared-secret',
      fetch: fetcher,
    });
    const response = await Promise.race([
      postEvent('human.intent', 'keep going'),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error('event ingestion waited for Wake')), 100),
      ),
    ]);
    expect(response.status).toBe(201);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  });
});

describe('quest API', () => {
  let directory: string;
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-quests-'));
    database = openDatabase(path.join(directory, 'pak.sqlite'), migrationsFolder);
    app = createApp({
      database,
      logger: silentLogger,
      now: () => new Date('2026-01-02T03:04:05.000Z'),
    });
  });

  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const send = (url: string, method: string, body: unknown, headers?: Record<string, string>) =>
    app.request(url, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  async function createWorldAndQuest() {
    await send('/api/worlds', 'POST', {
      id: 'game',
      name: 'Game',
      kind: 'game',
      order: 1,
      icon: '🎮',
    });
    return send('/api/quests', 'POST', {
      id: 'catch-up',
      worldId: 'game',
      title: 'Catch-Up',
      pitch: 'See recent work',
    });
  }

  it('upserts and lists worlds with complete quest counts', async () => {
    expect((await createWorldAndQuest()).status).toBe(200);
    const worlds = await (await app.request('/api/worlds')).json();
    expect(worlds).toEqual([
      {
        id: 'game',
        name: 'Game',
        kind: 'game',
        order: 1,
        icon: '🎮',
        questCounts: { idea: 1, planning: 0, building: 0, demo: 0, done: 0, parked: 0 },
      },
    ]);
    expect((await send('/api/worlds', 'POST', { id: '', name: '', kind: 'bad' })).status).toBe(400);
  });

  it('creates, filters, patches, and rejects invalid or unknown quests', async () => {
    const created = await createWorldAndQuest();
    expect(await created.json()).toMatchObject({
      id: 'catch-up',
      status: 'idea',
      progress: 0,
      sinceYouLooked: '',
      lastNote: '',
    });
    expect(await (await app.request('/api/quests?world=game&status=idea')).json()).toHaveLength(1);
    expect((await app.request('/api/quests?world=missing')).status).toBe(404);
    expect((await app.request('/api/quests/missing')).status).toBe(404);
    expect(
      (await send('/api/quests', 'POST', { id: 'x', worldId: 'missing', title: 'X', pitch: 'X' }))
        .status,
    ).toBe(404);
    expect((await send('/api/quests/catch-up', 'PATCH', {})).status).toBe(400);
    expect(
      await (await send('/api/quests/catch-up', 'PATCH', { status: 'building' })).json(),
    ).toMatchObject({ status: 'building' });
  });

  it('keeps links private while deriving progress and emitting sanitized events', async () => {
    await createWorldAndQuest();
    expect(
      (
        await send('/api/quests/catch-up/links', 'POST', {
          ghKind: 'issue',
          ghRef: '22',
          state: 'closed',
        })
      ).status,
    ).toBe(200);
    expect((await app.request('/api/quests/catch-up/links')).status).toBe(404);
    expect(
      await (
        await app.request('/api/quests/catch-up/links', { headers: { 'X-Planner': '1' } })
      ).json(),
    ).toEqual([{ questId: 'catch-up', ghKind: 'issue', ghRef: '22', state: 'closed' }]);
    const listText = JSON.stringify(await (await app.request('/api/quests')).json());
    const itemText = JSON.stringify(await (await app.request('/api/quests/catch-up')).json());
    const eventText = JSON.stringify(await (await app.request('/api/events')).json());
    expect(listText).not.toContain('ghRef');
    expect(itemText).not.toContain('ghRef');
    expect(eventText).not.toContain('ghRef');
    expect(eventText).not.toContain('22');
    expect(JSON.parse(itemText)).toMatchObject({ progress: 1 });
    expect(
      (
        await send('/api/quests/catch-up/links', 'POST', {
          ghKind: 'nope',
          ghRef: '1',
          state: 'open',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await send('/api/quests/missing/links', 'POST', {
          ghKind: 'issue',
          ghRef: '1',
          state: 'open',
        })
      ).status,
    ).toBe(404);
  });

  it('appends notes, updates lastNote, validates intent, and limits recent notes oldest-first', async () => {
    await createWorldAndQuest();
    expect(
      (
        await send('/api/quests/catch-up/notes', 'POST', {
          author: 'planner',
          text: 'First',
          intent: 'ask',
        })
      ).status,
    ).toBe(400);
    const first = await (
      await send('/api/quests/catch-up/notes', 'POST', {
        author: 'human',
        text: 'First',
        intent: 'nudge',
      })
    ).json();
    const second = await (
      await send('/api/quests/catch-up/notes', 'POST', { author: 'planner', text: 'Second' })
    ).json();
    expect(await (await app.request('/api/quests/catch-up/notes?limit=1')).json()).toEqual([
      second,
    ]);
    expect(first).toMatchObject({ id: 1, questId: 'catch-up', ts: '2026-01-02T03:04:05.000Z' });
    expect(await (await app.request('/api/quests/catch-up')).json()).toMatchObject({
      lastNote: 'Second',
    });
    expect((await app.request('/api/quests/catch-up/notes?limit=201')).status).toBe(400);
    expect((await app.request('/api/quests/missing/notes')).status).toBe(404);
  });

  it('emits park and unpark events for human status changes', async () => {
    await createWorldAndQuest();
    await send('/api/quests/catch-up', 'PATCH', { status: 'parked', source: 'human' });
    await send('/api/quests/catch-up', 'PATCH', { status: 'building', source: 'human' });
    const events = (await (await app.request('/api/events')).json()) as Array<{
      kind: string;
      payload: unknown;
    }>;
    expect(events.slice(-2)).toMatchObject([
      { kind: 'human.park', payload: { text: 'Park: Catch-Up' } },
      { kind: 'human.park', payload: { text: 'Unpark: Catch-Up' } },
    ]);
  });
});
