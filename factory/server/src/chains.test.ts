import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Chain, Event, Presence } from '@wyld/shared';
import { eq, inArray } from 'drizzle-orm';

import { createApp } from './app.js';
import { upsertBriefingChain } from './chain-cards.js';
import { ensureMechanicalBriefing } from './catchup.js';
import { CHAIN_LIMIT } from './chains.js';
import { openDatabase, type AppDatabase } from './database.js';
import { artifacts, chains, demos, presence, quests, worlds } from './schema.js';

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
  const postEvent = (index: number) =>
    post('/api/events', {
      source: 'human',
      kind: 'human.intent',
      payload: { text: String(index) },
    });

  const emptyDigest = { rumbles: [], demos: [], shipped: [], fyi: [] };

  const writeBriefing = (fromEventId = 0, toEventId = 0, headline?: string) =>
    upsertBriefingChain(
      database,
      { digest: emptyDigest, fromEventId, toEventId, ...(headline ? { headline } : {}) },
      clock.toISOString(),
    ).chain;

  it('creates a question and records its chain id', async () => {
    const chain = await create('What is going on?');
    expect(chain).toMatchObject({ status: 'open', messages: [{ author: 'human' }] });
    expect((await events())[0]).toMatchObject({
      kind: 'human.question',
      payload: { chainId: chain.id, text: 'What is going on?' },
    });
  });

  it('round-trips and filters artifact anchors', async () => {
    database.db
      .insert(artifacts)
      .values({
        slug: 'roadmap',
        questId: null,
        title: 'Roadmap',
        summary: 'One line',
        html: '<html></html>',
        version: 1,
        createdAt: clock.toISOString(),
        updatedAt: clock.toISOString(),
      })
      .run();
    const anchor = { artifact: 'roadmap', element: 'hero', label: 'Hero' };
    const response = await post('/api/chains', { text: 'Pinned', anchor });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ anchor });
    expect(
      (await (await app.request('/api/chains?artifact=roadmap')).json()) as unknown[],
    ).toHaveLength(1);
    expect(
      (await post('/api/chains', { text: 'Missing', anchor: { ...anchor, artifact: 'missing' } }))
        .status,
    ).toBe(404);
    expect(
      (await post('/api/chains', { text: 'Bad', anchor: { artifact: 'roadmap' } })).status,
    ).toBe(400);
    expect((await app.request('/api/chains?artifact=missing')).status).toBe(404);
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

  it.each([
    { questId: undefined, text: 'A proactive update' },
    { questId: 'target', text: 'A targeted update' },
  ])('creates a planner-authored chain with quest $questId', async ({ questId, text }) => {
    if (questId !== undefined) createQuest(questId);
    const response = await post('/api/chains', {
      text,
      author: 'planner',
      ...(questId === undefined ? {} : { questId }),
    });

    expect(response.status).toBe(201);
    const chain = Chain.parse(await response.json());
    expect(chain).toMatchObject({
      status: 'open',
      questId: questId ?? null,
      messages: [{ author: 'planner', text }],
    });
    expect(chain.messages).toHaveLength(1);
    expect(await events()).toEqual([
      expect.objectContaining({
        source: 'planner',
        kind: 'planner.chain_updated',
        ...(questId === undefined ? {} : { questId }),
        payload: {
          chainId: chain.id,
          text,
          ...(questId === undefined ? {} : { questId }),
        },
      }),
    ]);
  });

  it('rejects a chain targeted at an unknown quest', async () => {
    const response = await post('/api/chains', {
      text: 'Lost update',
      author: 'planner',
      questId: 'missing',
    });
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

  it('filters kinds and statuses while keeping rumbles outside the chain limit', async () => {
    for (let index = 0; index < CHAIN_LIMIT + 1; index++) await create(String(index));
    const message = Chain.parse(
      await (await post('/api/chains', { text: 'news', author: 'planner' })).json(),
    );
    await post('/api/rumbles', {
      title: 'Choose',
      context: 'Context',
      options: ['Yes'],
      kind: 'taste',
    });
    expect(await (await app.request('/api/chains?kind=message')).json()).toMatchObject([
      { id: message.id, kind: 'message' },
    ]);
    expect(await (await app.request('/api/chains?kind=rumble&status=all')).json()).toMatchObject([
      { kind: 'rumble', rumble: { id: 'choose' } },
    ]);
    expect(await (await app.request('/api/chains?kind=all')).json()).toHaveLength(CHAIN_LIMIT + 1);
    await post(`/api/chains/${message.id}/close`, { reason: 'settled' });
    expect(
      await (await app.request('/api/chains?kind=message&status=settled')).json(),
    ).toMatchObject([{ id: message.id }]);
  });

  it('lists card kinds explicitly without changing the default list', async () => {
    const question = await create('question');
    const message = Chain.parse(
      await (await post('/api/chains', { text: 'message', author: 'planner' })).json(),
    );
    await post('/api/demos', { id: 'card', ref: 'main', kind: 'live', summary: 'Demo card' });
    await app.request('/api/presence/next-action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Act now' }),
    });
    const defaults = (await (await app.request('/api/chains')).json()) as Chain[];
    expect(defaults.map(({ id }) => id)).toEqual([message.id, question.id]);
    expect(await (await app.request('/api/chains?kind=demo,action')).json()).toMatchObject([
      { kind: 'action' },
      { kind: 'demo' },
    ]);
    expect((await (await app.request('/api/chains?kind=all')).json()) as Chain[]).toHaveLength(4);
    expect((await app.request('/api/chains?kind=unknown')).status).toBe(400);

    const demo = database.db.select().from(chains).where(eq(chains.demoId, 'card')).get()!;
    await post(`/api/chains/${demo.id}/snooze`, { until: '2026-09-06T12:00:00.000Z' });
    expect(await (await app.request('/api/chains?kind=demo')).json()).toEqual([]);
    expect(
      await (await app.request('/api/chains?kind=demo&includeSnoozed=1')).json(),
    ).toMatchObject([{ id: demo.id }]);
    await post(`/api/chains/${demo.id}/close`, { reason: 'settled' });
    expect(
      await (await app.request('/api/chains?kind=demo&status=settled&includeSnoozed=1')).json(),
    ).toMatchObject([{ id: demo.id }]);
  });

  it('generates a mechanical briefing while listing briefing chains', async () => {
    database.db
      .update(presence)
      .set({ lastSeenAt: new Date(clock.getTime() - 3 * 60 * 60 * 1000).toISOString() })
      .where(eq(presence.id, 1))
      .run();

    const listed = Chain.array().parse(
      await (await app.request('/api/chains?kind=briefing')).json(),
    );

    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ kind: 'briefing', status: 'open' });
  });

  it('closing a briefing as read records lastCatchupEventId from its toEventId', async () => {
    const briefing = writeBriefing(2, 17);

    const response = await post(`/api/chains/${briefing.id}/close`, { reason: 'read' });

    expect(response.status).toBe(200);
    expect(database.db.select().from(presence).get()?.lastCatchupEventId).toBe(17);
  });

  it('a briefing written after a dismissal is a fresh chain', async () => {
    const dismissed = writeBriefing(2, 17);
    await post(`/api/chains/${dismissed.id}/close`, { reason: 'read' });

    const fresh = writeBriefing(17, 23);

    expect(fresh.id).not.toBe(dismissed.id);
    expect(fresh.payload).toMatchObject({ fromEventId: 17, toEventId: 23 });
  });

  it('close rejects reason read on a chain that is not a briefing', async () => {
    const question = await create('Unread question');

    const response = await post(`/api/chains/${question.id}/close`, { reason: 'read' });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Invalid request' });
  });

  it('a briefing does not change needsYou', async () => {
    const before = Presence.parse(await (await app.request('/api/presence')).json()).needsYou;

    writeBriefing(0, 4);

    expect(Presence.parse(await (await app.request('/api/presence')).json()).needsYou).toBe(before);
  });

  it('the mechanical generator creates a briefing when none is open', () => {
    database.db
      .update(presence)
      .set({ lastSeenAt: new Date(clock.getTime() - 3 * 60 * 60 * 1000).toISOString() })
      .where(eq(presence.id, 1))
      .run();

    ensureMechanicalBriefing(database, clock);

    expect(
      database.db.select().from(chains).where(eq(chains.kind, 'briefing')).get(),
    ).toMatchObject({ kind: 'briefing', status: 'open' });
  });

  it('the mechanical generator respects both away and unseen thresholds', async () => {
    database.db
      .update(presence)
      .set({ lastSeenAt: new Date(clock.getTime() - 60 * 60 * 1000).toISOString() })
      .where(eq(presence.id, 1))
      .run();
    for (let index = 0; index < 20; index += 1) await postEvent(index);
    ensureMechanicalBriefing(database, clock);
    expect(
      database.db.select().from(chains).where(eq(chains.kind, 'briefing')).get(),
    ).toBeUndefined();

    await postEvent(20);
    ensureMechanicalBriefing(database, clock);
    expect(
      database.db.select().from(chains).where(eq(chains.kind, 'briefing')).get(),
    ).toBeDefined();
  });

  it('the mechanical generator never overwrites an open briefing', async () => {
    const planner = writeBriefing(3, 9, 'Dru wrote this');
    const before = {
      chain: database.db.select().from(chains).where(eq(chains.id, planner.id)).get(),
      messages: database.sqlite
        .prepare('SELECT * FROM chain_messages WHERE chain_id = ? ORDER BY id')
        .all(planner.id),
    };
    database.db
      .update(presence)
      .set({ lastSeenAt: new Date(clock.getTime() - 3 * 60 * 60 * 1000).toISOString() })
      .where(eq(presence.id, 1))
      .run();

    await app.request('/api/catchup');
    await app.request('/api/chains?kind=briefing');

    expect({
      chain: database.db.select().from(chains).where(eq(chains.id, planner.id)).get(),
      messages: database.sqlite
        .prepare('SELECT * FROM chain_messages WHERE chain_id = ? ORDER BY id')
        .all(planner.id),
    }).toEqual(before);
  });

  it.each(['demo', 'action', 'unlock', 'rumble'])(
    'rejects reserved kind %s on create',
    async (kind) => {
      expect((await post('/api/chains', { text: 'not allowed', kind })).status).toBe(400);
    },
  );

  it('closes a quest demo as done and reopens its quest and visibility', async () => {
    createQuest('demo-quest');
    database.db.update(quests).set({ status: 'demo' }).where(eq(quests.id, 'demo-quest')).run();
    await post('/api/demos', {
      id: 'quest-demo',
      ref: 'main',
      kind: 'live',
      questId: 'demo-quest',
    });
    const demoChain = database.db
      .select()
      .from(chains)
      .where(eq(chains.demoId, 'quest-demo'))
      .get()!;
    const closed = await post(`/api/chains/${demoChain.id}/close`, { reason: 'done' });
    expect(await closed.json()).toMatchObject({ status: 'settled' });
    expect(database.db.select().from(quests).where(eq(quests.id, 'demo-quest')).get()?.status).toBe(
      'done',
    );
    expect(
      database.db.select().from(demos).where(eq(demos.id, 'quest-demo')).get()?.hiddenAt,
    ).not.toBeNull();
    expect((await events()).some(({ kind }) => kind === 'planner.quest_updated')).toBe(true);
    expect(await (await app.request('/api/demos')).json()).toEqual([]);

    const reopened = await post(`/api/chains/${demoChain.id}/reopen`, { source: 'human' });
    expect(await reopened.json()).toMatchObject({ status: 'open' });
    expect(database.db.select().from(quests).where(eq(quests.id, 'demo-quest')).get()?.status).toBe(
      'demo',
    );
    expect(
      database.db.select().from(demos).where(eq(demos.id, 'quest-demo')).get()?.hiddenAt,
    ).toBeNull();
    expect(await (await app.request('/api/demos')).json()).toHaveLength(1);
    expect((await post(`/api/chains/${demoChain.id}/reopen`, {})).status).toBe(200);
    expect((await post('/api/chains/999999/reopen', {})).status).toBe(404);

    const question = await create('not a demo');
    expect((await post(`/api/chains/${question.id}/close`, { reason: 'done' })).status).toBe(400);
    await post('/api/demos', { id: 'questless', ref: 'main', kind: 'live' });
    const questless = database.db
      .select()
      .from(chains)
      .where(eq(chains.demoId, 'questless'))
      .get()!;
    expect((await post(`/api/chains/${questless.id}/close`, { reason: 'done' })).status).toBe(400);
  });

  it('rejects reopening rumbles and does not auto-settle card chains', async () => {
    await post('/api/rumbles', { title: 'Choose', context: 'Now', options: ['A'], kind: 'taste' });
    await post('/api/demos', { id: 'quiet-demo', ref: 'main', kind: 'live' });
    await app.request('/api/presence/next-action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Quiet action' }),
    });
    const rumble = database.db.select().from(chains).where(eq(chains.kind, 'rumble')).get()!;
    database.db
      .insert(chains)
      .values({
        kind: 'unlock',
        status: 'open',
        createdAt: clock.toISOString(),
        lastActivityAt: clock.toISOString(),
        tags: ['unlock'],
      })
      .run();
    expect((await post(`/api/chains/${rumble.id}/reopen`, {})).status).toBe(400);
    clock = new Date(clock.getTime() + 25 * 60 * 60 * 1000);
    await app.request('/api/chains');
    expect(
      database.db
        .select()
        .from(chains)
        .where(inArray(chains.kind, ['demo', 'action', 'unlock']))
        .all()
        .every(({ status }) => status === 'open'),
    ).toBe(true);
  });

  it('snoozes and unsnoozes without events or immediate auto-settlement', async () => {
    const chain = await create('later');
    const eventCount = (await events()).length;
    const until = new Date(clock.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(await (await post(`/api/chains/${chain.id}/snooze`, { until })).json()).toMatchObject({
      snoozedUntil: until,
      status: 'open',
    });
    expect(await (await app.request('/api/chains')).json()).toEqual([]);
    expect(await (await app.request('/api/chains?includeSnoozed=1')).json()).toHaveLength(1);
    clock = new Date(new Date(until).getTime() + 1000);
    expect(await (await app.request('/api/chains')).json()).toHaveLength(1);
    expect(await (await post(`/api/chains/${chain.id}/unsnooze`, undefined)).json()).toMatchObject({
      snoozedUntil: null,
      status: 'open',
    });
    expect(await events()).toHaveLength(eventCount);
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

  it('attributes action rotation and planner closes only to the planner', async () => {
    await post('/api/presence/next-action', { text: 'First action' });
    await post('/api/presence/next-action', { text: 'Second action' });
    const actions = database.db.select().from(chains).where(eq(chains.kind, 'action')).all();
    expect(actions).toHaveLength(2);
    expect(actions.map(({ status }) => status)).toEqual(['settled', 'open']);
    const rotationEvents = await events();
    expect(rotationEvents.every(({ source }) => source === 'planner')).toBe(true);
    expect(rotationEvents.some(({ kind }) => kind === 'human.chain_closed')).toBe(false);

    const plannerChain = await create('Planner closes this');
    await post(`/api/chains/${plannerChain.id}/close`, { reason: 'settled', source: 'planner' });
    expect((await events()).at(-1)).toMatchObject({
      source: 'planner',
      kind: 'planner.chain_updated',
    });
    const humanChain = await create('Human closes this');
    await post(`/api/chains/${humanChain.id}/close`, { reason: 'settled', source: 'human' });
    expect((await events()).at(-1)).toMatchObject({
      source: 'human',
      kind: 'human.chain_closed',
    });
  });
});
