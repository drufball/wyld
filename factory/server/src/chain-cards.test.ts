import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { upsertBriefingChain } from './chain-cards.js';
import { openDatabase, type AppDatabase } from './database.js';
import { chains } from './schema.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

describe('chain cards', () => {
  let directory: string;
  let database: AppDatabase;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-chain-cards-'));
    database = openDatabase(path.join(directory, 'pak.sqlite'), migrations);
  });

  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('upserting a briefing twice keeps its id, range start, and newest body markers', () => {
    const empty = { rumbles: [], demos: [], shipped: [], fyi: [] };
    const first = upsertBriefingChain(
      database,
      { digest: { ...empty, fyi: ['First'] }, fromEventId: 4, toEventId: 8 },
      '2026-09-05T12:00:00.000Z',
    );
    const second = upsertBriefingChain(
      database,
      { digest: { ...empty, fyi: ['Second'] }, fromEventId: 99, toEventId: 12 },
      '2026-09-05T13:00:00.000Z',
    );

    expect(second.chain.id).toBe(first.chain.id);
    expect(second.created).toBe(false);
    expect(database.db.select().from(chains).all()).toHaveLength(1);
    expect(second.chain).toMatchObject({
      lastActivityAt: '2026-09-05T13:00:00.000Z',
      payload: {
        fyi: ['Second'],
        fromEventId: 4,
        toEventId: 12,
        updatedAt: '2026-09-05T13:00:00.000Z',
      },
    });
  });

  it('a new briefing is pinned by default', () => {
    const empty = { rumbles: [], demos: [], shipped: [], fyi: [] };
    const first = upsertBriefingChain(
      database,
      { digest: empty, fromEventId: 4, toEventId: 8 },
      '2026-09-05T12:00:00.000Z',
    );

    expect(first.chain.pinnedAt).toBe('2026-09-05T12:00:00.000Z');

    database.db.update(chains).set({ pinnedAt: null }).where(eq(chains.id, first.chain.id)).run();
    const rewritten = upsertBriefingChain(
      database,
      { digest: empty, fromEventId: 4, toEventId: 9 },
      '2026-09-05T13:00:00.000Z',
    );

    expect(rewritten.chain.pinnedAt).toBeNull();
  });
});
