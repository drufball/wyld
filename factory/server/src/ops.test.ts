import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type AppDatabase } from './database.js';
import { createOpsRoutes, latestOpsReport } from './ops.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

describe('ops routes', () => {
  let directory: string;
  let database: AppDatabase;
  const now = new Date('2026-09-05T12:00:00.000Z');

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-ops-'));
    database = openDatabase(path.join(directory, 'pak.sqlite'), migrations);
  });

  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const post = (body: unknown) =>
    createOpsRoutes({ database, now: () => now }).request('/ops/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('stores and returns a valid ops report', async () => {
    const body = {
      ciState: 'pass',
      ciDetail: 'main is green',
      codexPrsOpen: 2,
      ghRateRemaining: 4987,
      ghRateLimit: 5000,
      tokensToday: 1_234_567,
    };
    const response = await post(body);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 1, ts: now.toISOString(), ...body });
    expect(latestOpsReport(database)).toMatchObject(body);
  });

  it('rejects invalid reports with the standard issue list', async () => {
    const response = await post({ ciState: 'pass', codexPrsOpen: -1 });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ issues: [{ path: ['codexPrsOpen'] }] });
  });
});
