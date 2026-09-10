import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NewEvent } from '@wyld/shared';

import { openDatabase, type AppDatabase } from './database.js';
import { createPlannerHeartbeat } from './heartbeat.js';
import { events } from './schema.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

describe('planner heartbeat', () => {
  let directory: string;
  let database: AppDatabase;
  let now: Date;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-heartbeat-'));
    database = openDatabase(path.join(directory, 'db.sqlite'), migrations);
    now = new Date('2026-09-06T14:02:00.000Z');
  });
  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const storeEvent = async (event: NewEvent) => {
    database.db
      .insert(events)
      .values({ ...event, ts: now.toISOString() })
      .run();
  };
  const heartbeat = (enabled = true) =>
    createPlannerHeartbeat({ database, now: () => now, storeEvent, enabled });

  it('emits one planner tick per hour from three minutes past', async () => {
    const subject = heartbeat();
    await subject.tick();
    expect(database.db.select().from(events).all()).toHaveLength(0);
    now = new Date('2026-09-06T14:03:00.000Z');
    await subject.tick();
    await subject.tick();
    expect(database.db.select().from(events).all()).toMatchObject([
      { kind: 'planner.tick', payload: { at: '2026-09-06T14:03:00.000Z' } },
    ]);
  });

  it('does not emit a second planner tick in the same hour after a restart', async () => {
    now = new Date('2026-09-06T14:30:00.000Z');
    await heartbeat().tick();
    await heartbeat().tick();
    expect(database.db.select().from(events).all()).toHaveLength(1);
  });

  it('emits no planner tick when the heartbeat is disabled', async () => {
    now = new Date('2026-09-06T14:30:00.000Z');
    await heartbeat(false).tick();
    expect(database.db.select().from(events).all()).toHaveLength(0);
  });
});
