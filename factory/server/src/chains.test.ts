import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Chain, Event, Presence } from '@wyld/shared';
import { eq, inArray } from 'drizzle-orm';

import { createApp } from './app.js';
import { upsertBriefingChain } from './chain-cards.js';
import { CATCHUP_AWAY_SECONDS, ensureMechanicalBriefing } from './catchup.js';
import { CHAIN_LIMIT } from './chains.js';
import { openDatabase, type AppDatabase } from './database.js';
import { artifacts, chains, healthReports, presence, quests, worlds } from './schema.js';

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

  const createArtifact = (slug = 'forest-map') => {
    database.db
      .insert(artifacts)
      .values({
        slug,
        questId: null,
        title: 'Forest map',
        summary: 'One line',
        html: '<html></html>',
        version: 1,
        createdAt: clock.toISOString(),
        updatedAt: clock.toISOString(),
      })
      .onConflictDoNothing()
      .run();
  };

  const createLook = async (questId: string, text = 'Have a look') => {
    createArtifact(`explainer-${questId}`);
    return Chain.parse(
      await (
        await post('/api/chains', {
          text,
          author: 'planner',
          questId,
          explainer: `explainer-${questId}`,
        })
      ).json(),
    );
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

  it('stores a pin capture and serves its screenshot', async () => {
    createArtifact();
    const bytes = Buffer.from('jpeg bytes');
    const response = await post('/api/chains', {
      text: 'Look here',
      anchor: { artifact: 'forest-map', element: 'demo', label: 'Demo' },
      capture: {
        screenshot: `data:image/jpeg;base64,${bytes.toString('base64')}`,
        state: { day: 3 },
      },
    });
    expect(response.status).toBe(201);
    const chain = Chain.parse(await response.json());
    expect(chain.payload).toEqual({
      capture: {
        screenshot: `/api/chains/${chain.id}/screenshot`,
        state: { day: 3 },
        at: clock.toISOString(),
      },
    });
    const screenshot = await app.request(`/api/chains/${chain.id}/screenshot`);
    expect(screenshot.status).toBe(200);
    expect(screenshot.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await screenshot.arrayBuffer())).toEqual(bytes);
  });

  it('rejects a capture whose screenshot is not a data url', async () => {
    const response = await post('/api/chains', {
      text: 'Bad capture',
      capture: { screenshot: 'https://example.test/shot.png', state: { day: 3 } },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid screenshot' });
  });

  it('drops an oversized state dump but keeps the screenshot', async () => {
    const response = await post('/api/chains', {
      text: 'Large state',
      capture: {
        screenshot: 'data:image/png;base64,YQ==',
        state: { dump: 'x'.repeat(65_536) },
      },
    });
    expect(response.status).toBe(201);
    const chain = Chain.parse(await response.json());
    expect(chain.payload).toMatchObject({
      capture: { screenshot: `/api/chains/${chain.id}/screenshot`, state: null },
    });
    const screenshot = await app.request(`/api/chains/${chain.id}/screenshot`);
    expect(screenshot.status).toBe(200);
    expect(screenshot.headers.get('content-type')).toBe('image/png');
  });

  it('leaves payload null when no capture is sent', async () => {
    expect((await create('No evidence')).payload).toBeNull();
  });

  it('tags a look chain and records its explainer', async () => {
    createArtifact();
    const response = await post('/api/chains', {
      text: 'Look at this',
      kind: 'question',
      explainer: 'forest-map',
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      tags: ['look'],
      payload: { explainer: 'forest-map' },
    });
  });

  it('rejects a look chain for an explainer that does not exist', async () => {
    const response = await post('/api/chains', {
      text: 'Missing explainer',
      explainer: 'missing',
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not Found' });
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

  it('leaves a look chain open past the quiet window', async () => {
    createQuest('look-quiet');
    const chain = await createLook('look-quiet');
    clock = new Date(clock.getTime() + 25 * 60 * 60 * 1000);
    await app.request('/api/chains');
    expect(database.db.select().from(chains).where(eq(chains.id, chain.id)).get()?.status).toBe(
      'open',
    );
  });

  it('leaves a look chain open past the quiet window after Dru replies', async () => {
    createQuest('replied-look');
    const chain = await createLook('replied-look');
    await post(`/api/chains/${chain.id}/messages`, { author: 'human', text: 'I tried it' });
    clock = new Date(clock.getTime() + 25 * 60 * 60 * 1000);
    await app.request('/api/chains');
    expect(database.db.select().from(chains).where(eq(chains.id, chain.id)).get()?.status).toBe(
      'open',
    );
  });

  it('leaves a planner chain on a quest open past the quiet window', async () => {
    createQuest('planner-quest');
    const chain = Chain.parse(
      await (
        await post('/api/chains', {
          text: 'Quest update',
          author: 'planner',
          questId: 'planner-quest',
        })
      ).json(),
    );
    clock = new Date(clock.getTime() + 25 * 60 * 60 * 1000);
    await app.request('/api/chains');
    expect(database.db.select().from(chains).where(eq(chains.id, chain.id)).get()?.status).toBe(
      'open',
    );
  });

  it('settles a planner chain with no quest after 24 hours', async () => {
    const chain = Chain.parse(
      await (await post('/api/chains', { text: 'Update', author: 'planner' })).json(),
    );
    clock = new Date(clock.getTime() + 25 * 60 * 60 * 1000);
    await app.request('/api/chains');
    expect(database.db.select().from(chains).where(eq(chains.id, chain.id)).get()?.status).toBe(
      'settled',
    );
  });

  it('settles a question Dru asked on a quest after 24 hours', async () => {
    createQuest('human-quest');
    const chain = Chain.parse(
      await (await post('/api/chains', { text: 'Why?', questId: 'human-quest' })).json(),
    );
    clock = new Date(clock.getTime() + 25 * 60 * 60 * 1000);
    await app.request('/api/chains');
    expect(database.db.select().from(chains).where(eq(chains.id, chain.id)).get()?.status).toBe(
      'settled',
    );
  });

  it("settles the quest's open looks when the quest is marked done", async () => {
    createQuest('done-quest');
    const look = await createLook('done-quest');
    clock = new Date(clock.getTime() + 1000);
    await app.request('/api/quests/done-quest', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'done', source: 'planner' }),
    });
    expect(database.db.select().from(chains).where(eq(chains.id, look.id)).get()).toMatchObject({
      status: 'settled',
      lastActivityAt: clock.toISOString(),
    });
  });

  it("settles the quest's open looks when a demo chain is closed as done", async () => {
    createQuest('demo-done');
    const look = await createLook('demo-done');
    await post('/api/demos', {
      id: 'done-demo',
      ref: 'main',
      kind: 'live',
      questId: 'demo-done',
    });
    const demo = database.db
      .insert(chains)
      .values({
        kind: 'demo',
        status: 'open',
        questId: 'demo-done',
        demoId: 'done-demo',
        tags: ['demo'],
        createdAt: clock.toISOString(),
        lastActivityAt: clock.toISOString(),
      })
      .returning()
      .get();
    clock = new Date(clock.getTime() + 1000);
    await post(`/api/chains/${demo.id}/close`, { reason: 'done' });
    expect(database.db.select().from(chains).where(eq(chains.id, look.id)).get()).toMatchObject({
      status: 'settled',
      lastActivityAt: clock.toISOString(),
    });
  });

  it('leaves looks on other quests open when a quest is marked done', async () => {
    createQuest('done-one');
    createQuest('still-building');
    await createLook('done-one');
    const other = await createLook('still-building');
    await app.request('/api/quests/done-one', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    expect(database.db.select().from(chains).where(eq(chains.id, other.id)).get()?.status).toBe(
      'open',
    );
  });

  it('supersedes an earlier look on the same quest', async () => {
    createQuest('new-look');
    const older = await createLook('new-look', 'Old look');
    clock = new Date(clock.getTime() + 1000);
    const newer = await createLook('new-look', 'New look');
    const settled = Chain.array().parse(
      await (await app.request('/api/chains?status=settled')).json(),
    );
    expect(settled.find(({ id }) => id === older.id)).toMatchObject({
      status: 'settled',
      lastActivityAt: clock.toISOString(),
      messages: [
        { author: 'planner', text: 'Old look' },
        { author: 'planner', text: 'Superseded by a newer look.' },
      ],
    });
    expect(newer.status).toBe('open');
  });

  it('leaves a look on another quest open when a new look is requested', async () => {
    createQuest('look-one');
    createQuest('look-two');
    const first = await createLook('look-one');
    await createLook('look-two');
    expect(database.db.select().from(chains).where(eq(chains.id, first.id)).get()?.status).toBe(
      'open',
    );
  });

  it('settles a look chain when Dru settles it', async () => {
    createQuest('settled-look');
    const look = await createLook('settled-look');
    expect(
      Chain.parse(await (await post(`/api/chains/${look.id}/close`, { reason: 'settled' })).json())
        .status,
    ).toBe('settled');
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
    await app.request('/api/presence/next-action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Act now' }),
    });
    const defaults = (await (await app.request('/api/chains')).json()) as Chain[];
    expect(defaults.map(({ id }) => id)).toEqual([message.id, question.id]);
    expect(await (await app.request('/api/chains?kind=action')).json()).toMatchObject([
      { kind: 'action' },
    ]);
    expect((await (await app.request('/api/chains?kind=all')).json()) as Chain[]).toHaveLength(3);
    expect((await app.request('/api/chains?kind=unknown')).status).toBe(400);
  });

  it('generates a mechanical briefing while listing briefing chains', async () => {
    await postEvent(1);
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

  it('dismissing a briefing does not create a new one on the next list', async () => {
    const briefing = writeBriefing(0, 1);
    for (let index = 0; index < 25; index += 1) await postEvent(index);
    database.db
      .update(presence)
      .set({ lastSeenAt: clock.toISOString() })
      .where(eq(presence.id, 1))
      .run();

    await post(`/api/chains/${briefing.id}/close`, { reason: 'read' });
    const listed = Chain.array().parse(
      await (await app.request('/api/chains?kind=question,briefing')).json(),
    );

    expect(listed.filter(({ kind }) => kind === 'briefing')).toHaveLength(0);
    expect(database.db.select().from(chains).where(eq(chains.kind, 'briefing')).all()).toHaveLength(
      1,
    );
  });

  it('dismissing a briefing advances lastCatchupEventId to the latest event', async () => {
    const briefing = writeBriefing(0, 1);
    await postEvent(1);
    await postEvent(2);
    const latestEventId = (await events()).at(-1)!.id;

    const response = await post(`/api/chains/${briefing.id}/close`, { reason: 'read' });

    expect(response.status).toBe(200);
    expect(database.db.select().from(presence).get()?.lastCatchupEventId).toBe(latestEventId);
    expect(database.db.select().from(chains).where(eq(chains.id, briefing.id)).get()).toMatchObject(
      {
        lastActivityAt: clock.toISOString(),
        status: 'settled',
      },
    );
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

  it('the mechanical generator creates a briefing when none is open', async () => {
    await postEvent(1);
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

  it('a present Dru with many unseen events gets no mechanical briefing', async () => {
    database.db
      .update(presence)
      .set({ lastSeenAt: clock.toISOString() })
      .where(eq(presence.id, 1))
      .run();
    for (let index = 0; index < 25; index += 1) await postEvent(index);
    ensureMechanicalBriefing(database, clock);
    expect(
      database.db.select().from(chains).where(eq(chains.kind, 'briefing')).get(),
    ).toBeUndefined();
  });

  it('writes a mechanical briefing when Dru is away and the Planner is down', async () => {
    await postEvent(1);
    database.db
      .update(presence)
      .set({ lastSeenAt: new Date(clock.getTime() - 3 * 60 * 60 * 1000).toISOString() })
      .where(eq(presence.id, 1))
      .run();
    database.db
      .insert(healthReports)
      .values({ ts: new Date(clock.getTime() - 60 * 1000).toISOString(), plannerState: 'down' })
      .run();

    ensureMechanicalBriefing(database, clock);

    expect(
      database.db.select().from(chains).where(eq(chains.kind, 'briefing')).get(),
    ).toMatchObject({ kind: 'briefing', status: 'open' });
  });

  it('writes no mechanical briefing while the Planner is alive', async () => {
    await postEvent(1);
    database.db
      .update(presence)
      .set({ lastSeenAt: new Date(clock.getTime() - 3 * 60 * 60 * 1000).toISOString() })
      .where(eq(presence.id, 1))
      .run();

    for (const plannerState of ['working', 'online']) {
      database.db.delete(healthReports).run();
      database.db
        .insert(healthReports)
        .values({ ts: new Date(clock.getTime() - 60 * 1000).toISOString(), plannerState })
        .run();

      ensureMechanicalBriefing(database, clock);

      expect(
        database.db.select().from(chains).where(eq(chains.kind, 'briefing')).get(),
      ).toBeUndefined();
    }
  });

  it('writes no mechanical briefing within the away window after a dismissal', async () => {
    const briefing = writeBriefing(0, 0);
    await post(`/api/chains/${briefing.id}/close`, { reason: 'read' });
    database.db
      .update(presence)
      .set({ lastSeenAt: new Date(clock.getTime() - 3 * 60 * 60 * 1000).toISOString() })
      .where(eq(presence.id, 1))
      .run();
    database.db
      .update(chains)
      .set({ lastActivityAt: new Date(clock.getTime() - 10 * 60 * 1000).toISOString() })
      .where(eq(chains.id, briefing.id))
      .run();

    ensureMechanicalBriefing(database, clock);
    expect(
      database.db.select().from(chains).where(eq(chains.status, 'open')).get(),
    ).toBeUndefined();

    database.db
      .update(chains)
      .set({
        lastActivityAt: new Date(clock.getTime() - (CATCHUP_AWAY_SECONDS + 1) * 1000).toISOString(),
      })
      .where(eq(chains.id, briefing.id))
      .run();
    ensureMechanicalBriefing(database, clock);

    expect(database.db.select().from(chains).where(eq(chains.status, 'open')).get()).toMatchObject({
      kind: 'briefing',
    });
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

  it('pins and unpins idempotently without changing activity', async () => {
    const chain = await create('keep this handy');
    const first = Chain.parse(await (await post(`/api/chains/${chain.id}/pin`, undefined)).json());
    expect(first.pinnedAt).toBe(clock.toISOString());
    expect(first.lastActivityAt).toBe(chain.lastActivityAt);
    expect(Chain.array().parse(await (await app.request('/api/chains')).json())[0]?.pinnedAt).toBe(
      first.pinnedAt,
    );

    clock = new Date(clock.getTime() + 60_000);
    const second = Chain.parse(await (await post(`/api/chains/${chain.id}/pin`, undefined)).json());
    expect(second.pinnedAt).toBe(first.pinnedAt);
    expect(second.lastActivityAt).toBe(chain.lastActivityAt);
    expect(
      Chain.parse(await (await post(`/api/chains/${chain.id}/unpin`, undefined)).json()).pinnedAt,
    ).toBeNull();
  });

  it('returns 404 when pinning or unpinning an unknown chain', async () => {
    expect((await post('/api/chains/999/pin', undefined)).status).toBe(404);
    expect((await post('/api/chains/999/unpin', undefined)).status).toBe(404);
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
