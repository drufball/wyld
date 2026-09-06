import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Retro, SleepRun } from '@wyld/shared';
import { createApp } from './app.js';
import { openDatabase, type AppDatabase } from './database.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
describe('sleep routes', () => {
  let directory: string;
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-sleep-'));
    database = openDatabase(path.join(directory, 'db.sqlite'), migrations);
    app = createApp({
      database,
      demosDir: directory,
      feedbackDir: directory,
      now: () => new Date('2026-09-06T23:00:00.000Z'),
    });
  });
  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const send = (url: string, method: string, body: unknown) =>
    app.request(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  it('creates, progresses, ends, and lists a run', async () => {
    const created = await send('/api/sleep/goodnight', 'POST', {});
    expect(created.status).toBe(201);
    expect(SleepRun.parse(await created.json()).alarmsFired).toEqual(['goodnight']);
    expect((await send('/api/sleep/goodnight', 'POST', {})).status).toBe(409);
    expect(
      (await send('/api/sleep/1/phase', 'POST', { phase: 'drain', note: 'Working' })).status,
    ).toBe(200);
    const ended = await send('/api/sleep/1/end', 'POST', { outcome: 'clean' });
    expect(SleepRun.parse(await ended.json()).phases.at(-1)?.phase).toBe('ended');
    expect(
      SleepRun.array().parse(await (await app.request('/api/sleep/runs')).json()),
    ).toHaveLength(1);
  });
  it('validates and upserts retros as planner output', async () => {
    expect((await app.request('/api/retros/not-a-date')).status).toBe(400);
    const response = await send('/api/retros/2026-09-06', 'PUT', { summary: 'Quiet night' });
    expect(Retro.parse(await response.json())).toMatchObject({ generatedBy: 'planner', wins: [] });
    expect(Retro.array().parse(await (await app.request('/api/retros')).json())).toHaveLength(1);
  });
});
