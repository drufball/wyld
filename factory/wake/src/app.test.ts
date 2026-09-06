import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createWakeApp } from './app.js';
import { openDatabase, type AppDatabase } from './database.js';
import { messages } from './schema.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
const wakeSecret = 'wake-secret-1234';
const githubWebhookSecret = 'github-secret-123';

describe('Wake app', () => {
  let directory: string;
  let database: AppDatabase;
  let app: ReturnType<typeof createWakeApp>;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-wake-'));
    database = openDatabase(path.join(directory, 'wake.sqlite'), migrations);
    app = createWakeApp({ database, wakeSecret, githubWebhookSecret, logger: () => undefined });
  });
  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const validEvent = JSON.stringify({
    id: 1,
    ts: '2026-01-01T00:00:00.000Z',
    source: 'human',
    kind: 'human.intent',
    payload: { text: 'build it' },
  });
  async function queueDepth() {
    return ((await (await app.request('/health')).json()) as { queueDepth: number }).queueDepth;
  }

  it('reports no last GitHub event for an empty queue', async () => {
    const health = (await (await app.request('/health')).json()) as {
      lastGithubEventAt: string | null;
    };
    expect(health.lastGithubEventAt).toBeNull();
  });

  it('reports the newest GitHub message timestamp and ignores human messages', async () => {
    const createdAt = '2026-09-05T12:00:00.000Z';
    database.db
      .insert(messages)
      .values([
        {
          source: 'github',
          kind: 'github.issue_opened',
          summary: 'Older GitHub event',
          ts: '2026-09-05T09:00:00.000Z',
          createdAt,
          updatedAt: createdAt,
        },
        {
          source: 'github',
          kind: 'github.pr_opened',
          summary: 'Newest GitHub event',
          ts: '2026-09-05T10:00:00.000Z',
          createdAt,
          updatedAt: createdAt,
        },
        {
          source: 'human',
          kind: 'human.intent',
          summary: 'Later human event',
          ts: '2026-09-05T11:00:00.000Z',
          createdAt,
          updatedAt: createdAt,
        },
      ])
      .run();

    const health = (await (await app.request('/health')).json()) as {
      lastGithubEventAt: string | null;
    };
    expect(health.lastGithubEventAt).toBe('2026-09-05T10:00:00.000Z');
  });

  it.each([
    ['missing secret', {}, validEvent],
    ['wrong secret', { 'X-Wake-Secret': 'not-the-secret' }, validEvent],
    ['wrong-length secret', { 'X-Wake-Secret': 'x' }, validEvent],
    ['malformed body', { 'X-Wake-Secret': wakeSecret }, '{'],
  ])('silently drops /event with %s', async (_name, headers, body) => {
    expect((await app.request('/event', { method: 'POST', headers, body })).status).toBe(204);
    expect(await queueDepth()).toBe(0);
  });

  it('queues valid events', async () => {
    expect(
      (
        await app.request('/event', {
          method: 'POST',
          headers: { 'X-Wake-Secret': wakeSecret, 'content-type': 'application/json' },
          body: validEvent,
        })
      ).status,
    ).toBe(204);
    const response = await app.request('/queue/claim', {
      method: 'POST',
      headers: { 'X-Wake-Secret': wakeSecret, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(await response.json()).toMatchObject({ messages: [{ summary: 'Dru: build it' }] });
  });

  it('carries a sleep run id from ingress through claim', async () => {
    await app.request('/event', {
      method: 'POST',
      headers: { 'X-Wake-Secret': wakeSecret, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 2,
        ts: '2026-01-01T00:00:00.000Z',
        source: 'sleep',
        kind: 'sleep.alarm',
        payload: {
          runId: 7,
          alarm: 'goodnight',
          trigger: 'schedule',
          lightsOnAt: '2026-01-01T08:05:00.000Z',
        },
      }),
    });

    const response = await app.request('/queue/claim', {
      method: 'POST',
      headers: { 'X-Wake-Secret': wakeSecret, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(await response.json()).toMatchObject({
      messages: [{ kind: 'sleep.alarm', run: 7 }],
    });
  });

  it('persists pause state and releases untouched messages after resume', async () => {
    await app.request('/event', {
      method: 'POST',
      headers: { 'X-Wake-Secret': wakeSecret, 'content-type': 'application/json' },
      body: validEvent,
    });
    const authenticated = {
      method: 'POST' as const,
      headers: { 'X-Wake-Secret': wakeSecret, 'content-type': 'application/json' },
    };
    expect(
      await (await app.request('/queue/claim', { ...authenticated, body: '{}' })).json(),
    ).toMatchObject({ messages: [{ summary: 'Dru: build it' }] });

    expect(
      await (
        await app.request('/pause', {
          ...authenticated,
          body: JSON.stringify({ since: '2026-09-06T12:00:00.000Z' }),
        })
      ).json(),
    ).toEqual({ paused: true });
    expect(await queueDepth()).toBe(1);
    expect(await (await app.request('/health')).json()).toMatchObject({ paused: true });
    expect(
      await (await app.request('/queue/claim', { ...authenticated, body: '{}' })).json(),
    ).toEqual({ messages: [] });
    expect(await queueDepth()).toBe(1);

    database.sqlite.close();
    database = openDatabase(path.join(directory, 'wake.sqlite'), migrations);
    app = createWakeApp({ database, wakeSecret, githubWebhookSecret, logger: () => undefined });
    expect(await (await app.request('/health')).json()).toMatchObject({
      paused: true,
      queueDepth: 1,
    });
    expect(await (await app.request('/resume', { ...authenticated, body: '{}' })).json()).toEqual({
      paused: false,
    });
    expect(
      await (await app.request('/queue/claim', { ...authenticated, body: '{}' })).json(),
    ).toMatchObject({ messages: [{ summary: 'Dru: build it' }] });
  });

  it.each(['/pause', '/resume'])('secret-gates %s and allows repeated requests', async (route) => {
    const body = route === '/pause' ? { since: '2026-09-06T12:00:00.000Z' } : {};
    expect((await app.request(route, { method: 'POST', body: JSON.stringify(body) })).status).toBe(
      401,
    );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(
        (
          await app.request(route, {
            method: 'POST',
            headers: { 'X-Wake-Secret': wakeSecret, 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
        ).status,
      ).toBe(200);
    }
  });

  it('returns a chain id when claiming a question', async () => {
    await app.request('/event', {
      method: 'POST',
      headers: { 'X-Wake-Secret': wakeSecret, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 2,
        ts: '2026-01-01T00:00:00.000Z',
        source: 'human',
        kind: 'human.question',
        payload: { text: 'How does Wake work?', chainId: 7 },
      }),
    });

    const response = await app.request('/queue/claim', {
      method: 'POST',
      headers: { 'X-Wake-Secret': wakeSecret, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(await response.json()).toMatchObject({ messages: [{ chain: 7 }] });
  });

  it('claims unknown kinds and retires malformed stored rows', async () => {
    const logger = vi.fn();
    app = createWakeApp({ database, wakeSecret, githubWebhookSecret, logger });
    const createdAt = '2026-09-05T12:00:00.000Z';
    database.db
      .insert(messages)
      .values([
        {
          source: 'future-system',
          kind: 'human.telepathy',
          summary: 'A message from the future',
          ts: createdAt,
          createdAt,
          updatedAt: createdAt,
        },
        {
          source: 'human',
          kind: 'human.intent',
          summary: '',
          ts: createdAt,
          createdAt,
          updatedAt: createdAt,
        },
        {
          source: 'github',
          kind: 'github.pr_opened',
          summary: 'A pending pull request',
          ts: createdAt,
          createdAt,
          updatedAt: createdAt,
        },
      ])
      .run();

    const response = await app.request('/queue/claim', {
      method: 'POST',
      headers: { 'X-Wake-Secret': wakeSecret },
      body: JSON.stringify({ limit: 2 }),
    });
    expect(await response.json()).toMatchObject({
      messages: [
        { source: 'future-system', kind: 'human.telepathy', summary: 'A message from the future' },
      ],
    });
    expect(logger).toHaveBeenCalledWith(
      'warn',
      expect.any(String),
      expect.objectContaining({ id: 2 }),
    );

    const skipped = database.sqlite
      .prepare('SELECT delivered_at FROM messages WHERE id = ?')
      .get(2) as { delivered_at: string | null };
    expect(skipped.delivered_at).not.toBeNull();

    const secondResponse = await app.request('/queue/claim', {
      method: 'POST',
      headers: { 'X-Wake-Secret': wakeSecret },
      body: '{}',
    });
    const secondClaim = (await secondResponse.json()) as { messages: Array<{ id: number }> };
    expect(secondClaim.messages).toMatchObject([
      { id: 1, summary: 'A message from the future' },
      { id: 3, summary: 'A pending pull request' },
    ]);

    await app.request('/queue/ack', {
      method: 'POST',
      headers: { 'X-Wake-Secret': wakeSecret, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: secondClaim.messages.map(({ id }) => id) }),
    });
    expect(await queueDepth()).toBe(0);
  });

  it.each([
    ['unsigned', {}],
    ['wrongly signed', { 'X-Hub-Signature-256': 'sha256=wrong' }],
  ])('silently drops an %s GitHub request', async (_name, headers) => {
    const response = await app.request('/gh', {
      method: 'POST',
      headers: { ...headers, 'X-GitHub-Event': 'issues' },
      body: '{}',
    });
    expect(response.status).toBe(204);
    expect(await queueDepth()).toBe(0);
  });

  it('verifies a GitHub signature over the raw body', async () => {
    const body = JSON.stringify({
      action: 'opened',
      issue: {
        number: 12,
        title: 'Wake',
        html_url: 'https://example.test/12',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      sender: { login: 'dru' },
    });
    const signature = `sha256=${createHmac('sha256', githubWebhookSecret).update(body).digest('hex')}`;
    const response = await app.request('/gh', {
      method: 'POST',
      headers: { 'X-Hub-Signature-256': signature, 'X-GitHub-Event': 'issues' },
      body,
    });
    expect(response.status).toBe(204);
    const health = (await (await app.request('/health')).json()) as { queueDepth: number };
    expect(health.queueDepth).toBe(1);
  });

  it('queues bot-sent check suites but drops bot-sent issue comments', async () => {
    async function signedGithub(eventType: string, payload: unknown) {
      const body = JSON.stringify(payload);
      const signature = `sha256=${createHmac('sha256', githubWebhookSecret).update(body).digest('hex')}`;
      return app.request('/gh', {
        method: 'POST',
        headers: { 'X-Hub-Signature-256': signature, 'X-GitHub-Event': eventType },
        body,
      });
    }
    await signedGithub('check_suite', {
      action: 'completed',
      sender: { login: 'github-actions[bot]', type: 'Bot' },
      check_suite: { conclusion: 'success', head_branch: 'main', pull_requests: [{ number: 14 }] },
    });
    expect(await queueDepth()).toBe(1);
    await signedGithub('issue_comment', {
      action: 'created',
      sender: { login: 'noise[bot]', type: 'Bot' },
      issue: { number: 14, title: 'Wake' },
      comment: { body: 'noise', user: { login: 'noise[bot]', type: 'Bot' } },
    });
    expect(await queueDepth()).toBe(1);
  });

  it('acks claimed messages and rejects bad claim and ack secrets', async () => {
    await app.request('/event', {
      method: 'POST',
      headers: { 'X-Wake-Secret': wakeSecret },
      body: validEvent,
    });
    const badClaim = await app.request('/queue/claim', {
      method: 'POST',
      headers: { 'X-Wake-Secret': 'bad' },
      body: '{}',
    });
    const badAck = await app.request('/queue/ack', {
      method: 'POST',
      headers: { 'X-Wake-Secret': 'bad' },
      body: '{"ids":[1]}',
    });
    expect(badClaim.status).toBe(401);
    expect(badAck.status).toBe(401);
    const claim = await app.request('/queue/claim', {
      method: 'POST',
      headers: { 'X-Wake-Secret': wakeSecret },
      body: '{}',
    });
    const claimed = (await claim.json()) as { messages: Array<{ id: number }> };
    const ack = await app.request('/queue/ack', {
      method: 'POST',
      headers: { 'X-Wake-Secret': wakeSecret, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [claimed.messages[0]!.id] }),
    });
    expect(await ack.json()).toEqual({ acked: 1 });
    expect(await queueDepth()).toBe(0);
    expect(database.sqlite.prepare('SELECT delivered_at FROM messages').get()).toMatchObject({
      delivered_at: expect.any(String),
    });
  });
});
