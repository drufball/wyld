import { and, count, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import type { Achievement } from '@wyld/shared';

import type { AppDatabase } from './database.js';
import { chainMessages, chains, demos } from './schema.js';

type DemoRow = typeof demos.$inferSelect;

export function demoUrl(row: Pick<DemoRow, 'id' | 'kind' | 'deepLink'>) {
  return row.kind === 'live'
    ? (row.deepLink ?? '/')
    : `/play/${row.id}/${(row.deepLink ?? '/').replace(/^\//, '')}`;
}

export function demoPayload(row: DemoRow) {
  return {
    title: row.title,
    kind: row.kind,
    summary: row.summary,
    steps: row.steps ?? [],
    seeded: row.seeded ?? [],
    deepLink: row.deepLink,
    url: demoUrl(row),
    status: row.status,
    builtAt: row.builtAt,
    error: row.error,
  };
}

export function ensureDemoChain(database: AppDatabase, row: DemoRow, now: string) {
  const { db } = database;
  const existing = db.select().from(chains).where(eq(chains.demoId, row.id)).get();
  const tags = ['demo', row.kind, ...(row.questId === null ? [] : ['quest'])];
  if (existing === undefined) {
    const created = db
      .insert(chains)
      .values({
        kind: 'demo',
        status: 'open',
        createdAt: now,
        lastActivityAt: now,
        questId: row.questId,
        tags,
        demoId: row.id,
        payload: demoPayload(row),
      })
      .returning()
      .get();
    db.insert(chainMessages)
      .values({ chainId: created.id, author: 'planner', text: row.summary ?? row.title, ts: now })
      .run();
    return { chain: created, changed: true };
  }
  db.update(chains)
    .set({
      status: 'open',
      lastActivityAt: existing.status === 'open' ? existing.lastActivityAt : now,
      questId: row.questId,
      tags,
      payload: demoPayload(row),
    })
    .where(eq(chains.id, existing.id))
    .run();
  const message = db
    .select()
    .from(chainMessages)
    .where(eq(chainMessages.chainId, existing.id))
    .get();
  if (message === undefined)
    db.insert(chainMessages)
      .values({ chainId: existing.id, author: 'planner', text: row.summary ?? row.title, ts: now })
      .run();
  else
    db.update(chainMessages)
      .set({ text: row.summary ?? row.title })
      .where(eq(chainMessages.id, message.id))
      .run();
  const refreshed = db.select().from(chains).where(eq(chains.id, existing.id)).get()!;
  return { chain: refreshed, changed: existing.status !== 'open' };
}

export function settleDemoChain(database: AppDatabase, demoId: string, now: string) {
  return database.db
    .update(chains)
    .set({ status: 'settled', lastActivityAt: now })
    .where(and(eq(chains.demoId, demoId), eq(chains.status, 'open')))
    .returning()
    .get();
}

export function reopenDemoChain(database: AppDatabase, demoId: string, now: string) {
  const row = database.db.select().from(demos).where(eq(demos.id, demoId)).get();
  return row === undefined ? undefined : ensureDemoChain(database, row, now);
}

export function replaceActionChain(
  database: AppDatabase,
  action: { text: string; deepLink: string | null; backAt: string | null },
  now: string,
) {
  const { db } = database;
  db.update(chains)
    .set({ status: 'settled', lastActivityAt: now })
    .where(and(eq(chains.kind, 'action'), eq(chains.status, 'open')))
    .run();
  const chain = db
    .insert(chains)
    .values({
      kind: 'action',
      status: 'open',
      createdAt: now,
      lastActivityAt: now,
      questId: null,
      tags: ['action'],
      payload: { deepLink: action.deepLink, backAt: action.backAt },
    })
    .returning()
    .get();
  db.insert(chainMessages)
    .values({ chainId: chain.id, author: 'planner', text: action.text, ts: now })
    .run();
  return chain;
}

export function createUnlockChain(
  database: AppDatabase,
  achievement: Pick<Achievement, 'id' | 'name' | 'badge'>,
  now: string,
) {
  const chain = database.db
    .insert(chains)
    .values({
      kind: 'unlock',
      status: 'open',
      createdAt: now,
      lastActivityAt: now,
      questId: null,
      tags: ['unlock'],
      payload: {
        achievementId: achievement.id,
        name: achievement.name,
        badge: achievement.badge,
      },
    })
    .returning()
    .get();
  database.db
    .insert(chainMessages)
    .values({
      chainId: chain.id,
      author: 'planner',
      text: `Achievement unlocked — ${achievement.name}`,
      ts: now,
    })
    .run();
  return chain;
}

export function countNeedsYou(database: AppDatabase, now: string) {
  return (
    database.db
      .select({ value: count() })
      .from(chains)
      .where(
        and(
          eq(chains.status, 'open'),
          inArray(chains.kind, ['question', 'message', 'rumble', 'demo']),
          or(isNull(chains.snoozedUntil), lt(chains.snoozedUntil, now)),
        ),
      )
      .get()?.value ?? 0
  );
}
