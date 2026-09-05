import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createWakeApp } from './app.js';
import { openDatabase, type AppDatabase } from './database.js';

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

  it('silently drops bad ingress and queues valid events', async () => {
    const event = JSON.stringify({
      id: 1,
      ts: '2026-01-01T00:00:00.000Z',
      source: 'human',
      kind: 'human.intent',
      payload: { text: 'build it' },
    });
    expect((await app.request('/event', { method: 'POST', body: event })).status).toBe(204);
    expect(
      (
        await app.request('/event', {
          method: 'POST',
          headers: { 'X-Wake-Secret': wakeSecret, 'content-type': 'application/json' },
          body: event,
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
});
