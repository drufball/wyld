import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Event, Rumble } from '@wyld/shared';

import { createApp } from './app.js';
import { openDatabase, type AppDatabase } from './database.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

describe('rumble routes', () => {
  let directory: string;
  let database: AppDatabase;
  let clock: Date;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-rumbles-'));
    database = openDatabase(path.join(directory, 'pak.sqlite'), migrations);
    clock = new Date('2026-09-05T12:00:00.000Z');
    app = createApp({
      database,
      demosDir: path.join(directory, 'demos'),
      feedbackDir: path.join(directory, 'feedback'),
      now: () => clock,
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
  const create = async (title: string, overrides: Record<string, unknown> = {}) => {
    const response = await post('/api/rumbles', {
      title,
      context: 'Context',
      options: ['Yes', 'No'],
      kind: 'taste',
      ...overrides,
    });
    expect(response.status).toBe(201);
    return Rumble.parse(await response.json());
  };

  it('creates slugs, resolves collisions, and upserts explicit ids without losing decisions', async () => {
    const first = await create('  Branch protection ON main!  ');
    const second = await create('Branch protection on main');
    expect([first.id, second.id]).toEqual([
      'branch-protection-on-main',
      'branch-protection-on-main-2',
    ]);
    await post(`/api/rumbles/${first.id}/decide`, { chosen: 'Yes' });
    clock = new Date('2026-09-06T12:00:00.000Z');
    const updated = await create('Updated', { id: first.id, options: ['Keep'], kind: 'scope' });
    expect(updated).toMatchObject({
      id: first.id,
      title: 'Updated',
      chosen: 'Yes',
      chosenAt: '2026-09-05T12:00:00.000Z',
    });
  });

  it('creates an already-decided rumble silently and includes it in decided results', async () => {
    const decided = await create('Seeded choice', { chosen: 'Yes' });
    expect(decided).toMatchObject({
      chosen: 'Yes',
      chosenAt: '2026-09-05T12:00:00.000Z',
    });
    expect(Event.array().parse(await (await app.request('/api/events')).json())).toEqual([]);
    expect(
      Rumble.array()
        .parse(await (await app.request('/api/rumbles?status=decided')).json())
        .map(({ id }) => id),
    ).toEqual([decided.id]);
  });

  it('rejects an initial choice outside the available options', async () => {
    const response = await post('/api/rumbles', {
      title: 'Bad seed',
      context: 'Context',
      options: ['Yes', 'No'],
      kind: 'taste',
      chosen: 'Maybe',
    });
    expect(response.status).toBe(400);
    expect((await response.json()) as { issues: { path: string[] }[] }).toMatchObject({
      issues: [{ path: ['chosen'] }],
    });
  });

  it('orders and filters open and decided rumbles by the shared rules', async () => {
    const older = await create('older', { id: 'z-older' });
    const tied = await create('tied', { id: 'a-tied' });
    clock = new Date(clock.getTime() + 1000);
    const blocked = await create('blocked', { blockingQuestIds: ['one', 'two'] });
    const outage = await create('outage', { kind: 'outage' });
    await post(`/api/rumbles/${older.id}/decide`, { chosen: 'Yes' });
    clock = new Date(clock.getTime() + 1000);
    await post(`/api/rumbles/${tied.id}/decide`, { chosen: 'No' });
    const all = Rumble.array().parse(await (await app.request('/api/rumbles')).json());
    expect(all.map(({ id }) => id)).toEqual([outage.id, blocked.id, tied.id, older.id]);
    expect(
      Rumble.array()
        .parse(await (await app.request('/api/rumbles?status=open')).json())
        .map(({ id }) => id),
    ).toEqual([outage.id, blocked.id]);
    expect(
      Rumble.array()
        .parse(await (await app.request('/api/rumbles?status=decided')).json())
        .map(({ id }) => id),
    ).toEqual([tied.id, older.id]);
  });

  it('decides and re-decides while storing exactly one complete event each time', async () => {
    const rumble = await create('Pick one', { blockingQuestIds: ['quest-a', 'quest-b'] });
    const first = Rumble.parse(
      await (await post(`/api/rumbles/${rumble.id}/decide`, { chosen: 'Yes' })).json(),
    );
    clock = new Date(clock.getTime() + 1000);
    const second = Rumble.parse(
      await (await post(`/api/rumbles/${rumble.id}/decide`, { chosen: 'No' })).json(),
    );
    expect(second).toMatchObject({ chosen: 'No', chosenAt: '2026-09-05T12:00:01.000Z' });
    expect(second.chosenAt).not.toBe(first.chosenAt);
    const events = Event.array().parse(await (await app.request('/api/events')).json());
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      source: 'human',
      kind: 'human.decision',
      questId: 'quest-a',
      payload: {
        rumbleId: rumble.id,
        chosen: 'Yes',
        blockingQuestIds: ['quest-a', 'quest-b'],
        text: 'Pick one → Yes',
      },
    });
  });

  it('rejects an unavailable option and returns 404 for an unknown rumble', async () => {
    const rumble = await create('Pick');
    const invalid = await post(`/api/rumbles/${rumble.id}/decide`, { chosen: 'Maybe' });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      error: 'Invalid request',
      issues: [
        {
          code: 'custom',
          path: ['chosen'],
          message: 'chosen must be one of: Yes, No',
        },
      ],
    });
    expect((await post('/api/rumbles/missing/decide', { chosen: 'Yes' })).status).toBe(404);
    expect(Event.array().parse(await (await app.request('/api/events')).json())).toEqual([]);
  });

  it('shows only open rumbles in catch-up order', async () => {
    const regular = await create('Regular');
    const outage = await create('Outage', { kind: 'outage' });
    await post(`/api/rumbles/${regular.id}/decide`, { chosen: 'Yes' });
    const view = (await (await app.request('/api/catchup')).json()) as {
      catchup: { digest: { rumbles: unknown[] } };
    };
    expect(view.catchup.digest.rumbles).toEqual([{ text: outage.title, deepLink: '/rumble' }]);
  });

  it('round-trips a rumble through the chain API', async () => {
    const rumble = await create('Trail', { blockingQuestIds: ['climb'] });
    expect(await (await app.request('/api/chains?kind=rumble')).json()).toMatchObject([
      { kind: 'rumble', messages: [], rumble },
    ]);
    expect(await (await app.request('/api/chains')).json()).toEqual([]);
  });
});
