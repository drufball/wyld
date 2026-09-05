import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Chain, Event } from '@wyld/shared';

import { createApp } from './app.js';
import { CHAIN_LIMIT } from './chains.js';
import { openDatabase, type AppDatabase } from './database.js';
import { quests, worlds } from './schema.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

describe('chain routes', () => {
  let directory: string;
  let database: AppDatabase;
  let clock: Date;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-chains-'));
    database = openDatabase(path.join(directory, 'pak.sqlite'), migrations);
    clock = new Date('2026-09-05T12:00:00.000Z');
    app = createApp({ database, now: () => clock, logger: () => undefined });
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

  const create = async (text: string) =>
    Chain.parse(await (await post('/api/chains', { text })).json());

  const createQuest = (id: string) => {
    database.db
      .insert(worlds)
      .values({ id: 'factory', name: 'Factory', kind: 'factory', order: 1, icon: 'factory' })
      .onConflictDoNothing()
      .run();
    database.db
      .insert(quests)
      .values({
        id,
        worldId: 'factory',
        title: id,
        pitch: 'Test quest',
        status: 'building',
        sinceYouLooked: '',
        lastNote: '',
      })
      .run();
  };

  const events = async () => Event.array().parse(await (await app.request('/api/events')).json());

  it('creates a question and records its chain id', async () => {
    const chain = await create('What is going on?');
    expect(chain).toMatchObject({ status: 'open', messages: [{ author: 'human' }] });
    expect((await events())[0]).toMatchObject({
      kind: 'human.question',
      payload: { chainId: chain.id, text: 'What is going on?' },
    });
  });

  it('creates a quest-targeted chain and routes its question event to the quest', async () => {
    createQuest('target');
    const response = await post('/api/chains', { text: 'Quest question', questId: 'target' });
    expect(response.status).toBe(201);
    const chain = Chain.parse(await response.json());
    expect(chain.questId).toBe('target');
    expect((await events()).at(-1)).toMatchObject({
      kind: 'human.question',
      questId: 'target',
      payload: { chainId: chain.id, text: 'Quest question', questId: 'target' },
    });
  });

  it('rejects a chain targeted at an unknown quest', async () => {
    const response = await post('/api/chains', { text: 'Lost question', questId: 'missing' });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not Found' });
  });

  it('appends a planner answer and records an update', async () => {
    const chain = await create('Question');
    const response = await post(`/api/chains/${chain.id}/messages`, {
      author: 'planner',
      text: 'Answer',
    });
    expect(response.status).toBe(201);
    expect(Chain.parse(await response.json()).messages).toHaveLength(2);
    expect((await events()).at(-1)?.kind).toBe('planner.chain_updated');
  });

  it('routes a planner answer on a targeted chain to its quest', async () => {
    createQuest('target');
    const chain = Chain.parse(
      await (await post('/api/chains', { text: 'Question', questId: 'target' })).json(),
    );
    await post(`/api/chains/${chain.id}/messages`, { author: 'planner', text: 'Answer' });
    expect((await events()).at(-1)).toMatchObject({
      kind: 'planner.chain_updated',
      questId: 'target',
      payload: { chainId: chain.id, text: 'Answer', questId: 'target' },
    });
  });

  it('lists only open chains newest-first', async () => {
    const old = await create('old');
    clock = new Date(clock.getTime() + 1000);
    const settled = await create('settled');
    await post(`/api/chains/${settled.id}/close`, { reason: 'settled' });
    clock = new Date(clock.getTime() + 1000);
    const converted = await create('converted');
    await post(`/api/chains/${converted.id}/close`, { reason: 'converted' });
    clock = new Date(clock.getTime() + 1000);
    const newest = await create('newest');
    expect((await (await app.request('/api/chains')).json()) as Chain[]).toMatchObject([
      { id: newest.id },
      { id: old.id },
    ]);
  });

  it('filters open chains by quest without excluding targeted chains from the full list', async () => {
    createQuest('first');
    createQuest('second');
    const first = Chain.parse(
      await (await post('/api/chains', { text: 'first', questId: 'first' })).json(),
    );
    clock = new Date(clock.getTime() + 1000);
    const second = Chain.parse(
      await (await post('/api/chains', { text: 'second', questId: 'second' })).json(),
    );
    clock = new Date(clock.getTime() + 1000);
    const free = await create('free');

    expect(await (await app.request('/api/chains?quest=first')).json()).toMatchObject([
      { id: first.id, questId: 'first' },
    ]);
    expect(await (await app.request('/api/chains')).json()).toMatchObject([
      { id: free.id },
      { id: second.id },
      { id: first.id },
    ]);
  });

  it('returns not found when filtering by an unknown quest', async () => {
    const response = await app.request('/api/chains?quest=missing');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not Found' });
  });

  it('settles chains quiet for more than 24 hours', async () => {
    const chain = await create('quiet');
    clock = new Date(clock.getTime() + 25 * 60 * 60 * 1000);
    expect(await (await app.request('/api/chains')).json()).toEqual([]);
    expect(database.sqlite.prepare('SELECT status FROM chains WHERE id = ?').get(chain.id)).toEqual(
      {
        status: 'settled',
      },
    );
  });

  it('limits the open-chain list', async () => {
    for (let index = 0; index < CHAIN_LIMIT + 2; index++) {
      await create(String(index));
      clock = new Date(clock.getTime() + 1000);
    }
    expect(await (await app.request('/api/chains')).json()).toHaveLength(CHAIN_LIMIT);
  });

  it('does not append to a closed chain', async () => {
    const chain = await create('done');
    await post(`/api/chains/${chain.id}/close`, { reason: 'settled' });
    expect(
      (await post(`/api/chains/${chain.id}/messages`, { author: 'human', text: 'more' })).status,
    ).toBe(404);
  });

  it('converts a targeted chain without changing its quest and records the human close', async () => {
    createQuest('question-chains');
    const chain = Chain.parse(
      await (await post('/api/chains', { text: 'build this', questId: 'question-chains' })).json(),
    );
    const response = await post(`/api/chains/${chain.id}/close`, {
      reason: 'converted',
    });
    expect(await response.json()).toMatchObject({
      status: 'converted',
      questId: 'question-chains',
    });
    expect((await events()).at(-1)).toMatchObject({
      kind: 'human.chain_closed',
      questId: 'question-chains',
      payload: {
        chainId: chain.id,
        reason: 'converted',
        text: 'Made a quest of: build this',
        questId: 'question-chains',
      },
    });
  });
});
