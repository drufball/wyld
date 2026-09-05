import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { WakeMessage } from '@wyld/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { enqueueMessage, openDatabase, type AppDatabase } from './database.js';
import { messages } from './schema.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
const base: WakeMessage = {
  source: 'github',
  kind: 'github.pr_synced',
  pr: 14,
  summary: 'PR #14 updated',
  ts: '2026-01-01T00:00:00.000Z',
};

describe('enqueueMessage', () => {
  let directory: string;
  let database: AppDatabase;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-wake-db-'));
    database = openDatabase(path.join(directory, 'wake.sqlite'), migrations);
  });
  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('coalesces the same kind and PR five seconds apart', () => {
    enqueueMessage(database, base, new Date('2026-01-01T00:00:00.000Z'));
    enqueueMessage(database, base, new Date('2026-01-01T00:00:05.000Z'));
    expect(database.db.select().from(messages).all()).toMatchObject([
      { count: 2, summary: 'PR #14 updated (+1 earlier updates)' },
    ]);
  });

  it('keeps matching updates ninety seconds apart separate', () => {
    enqueueMessage(database, base, new Date('2026-01-01T00:00:00.000Z'));
    enqueueMessage(database, base, new Date('2026-01-01T00:01:30.000Z'));
    expect(database.db.select().from(messages).all()).toHaveLength(2);
  });

  it('keeps different kinds for the same PR separate', () => {
    enqueueMessage(database, base, new Date('2026-01-01T00:00:00.000Z'));
    enqueueMessage(
      database,
      { ...base, kind: 'github.pr_review' },
      new Date('2026-01-01T00:00:05.000Z'),
    );
    expect(database.db.select().from(messages).all()).toHaveLength(2);
  });

  it.each([undefined, 'wake-24'])('never coalesces questions with quest %s', (quest) => {
    const question: WakeMessage = {
      source: 'human',
      kind: 'human.question',
      summary: 'Dru asks: What next?',
      ts: '2026-01-01T00:00:00.000Z',
      ...(quest === undefined ? {} : { quest }),
    };
    enqueueMessage(database, question, new Date('2026-01-01T00:00:00.000Z'));
    enqueueMessage(database, question, new Date('2026-01-01T00:00:05.000Z'));

    expect(database.db.select().from(messages).all()).toHaveLength(2);
  });
});
