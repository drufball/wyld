import { and, count, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { Achievement, CatchupDigest } from '@wyld/shared';

import type { AppDatabase } from './database.js';
import { chainMessages, chains, demos } from './schema.js';

type DemoRow = typeof demos.$inferSelect;

export function demoUrl(row: Pick<DemoRow, 'id' | 'kind' | 'deepLink'>) {
  return row.kind === 'live'
    ? (row.deepLink ?? '/')
    : `/play/${row.id}/${(row.deepLink ?? '/').replace(/^\//, '')}`;
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

export function settleLookChains(database: AppDatabase, questId: string, now: string) {
  database.db
    .update(chains)
    .set({ status: 'settled', lastActivityAt: now })
    .where(
      and(
        eq(chains.questId, questId),
        eq(chains.status, 'open'),
        sql`EXISTS (SELECT 1 FROM json_each(${chains.tags}) WHERE value = 'look')`,
      ),
    )
    .run();
}

export function readOpenBriefing(database: AppDatabase): typeof chains.$inferSelect | undefined {
  return database.db
    .select()
    .from(chains)
    .where(and(eq(chains.kind, 'briefing'), eq(chains.status, 'open')))
    .orderBy(desc(chains.id))
    .get();
}

export function upsertBriefingChain(
  database: AppDatabase,
  input: { digest: CatchupDigest; headline?: string; fromEventId: number; toEventId: number },
  now: string,
): { chain: typeof chains.$inferSelect; created: boolean } {
  const existing = readOpenBriefing(database);
  if (existing === undefined) {
    const chain = database.db
      .insert(chains)
      .values({
        kind: 'briefing',
        status: 'open',
        tags: ['briefing'],
        questId: null,
        payload: {
          ...input.digest,
          fromEventId: input.fromEventId,
          toEventId: input.toEventId,
          updatedAt: now,
        },
        createdAt: now,
        lastActivityAt: now,
        pinnedAt: now,
      })
      .returning()
      .get();
    database.db
      .insert(chainMessages)
      .values({
        chainId: chain.id,
        author: 'planner',
        text: input.headline ?? "Here's where things stand.",
        ts: now,
      })
      .run();
    return { chain, created: true };
  }
  const fromEventId =
    existing.payload !== null && typeof existing.payload['fromEventId'] === 'number'
      ? existing.payload['fromEventId']
      : input.fromEventId;
  database.db
    .update(chains)
    .set({
      payload: { ...input.digest, fromEventId, toEventId: input.toEventId, updatedAt: now },
      lastActivityAt: now,
    })
    .where(eq(chains.id, existing.id))
    .run();
  if (input.headline !== undefined)
    database.db
      .update(chainMessages)
      .set({ text: input.headline })
      .where(and(eq(chainMessages.chainId, existing.id), eq(chainMessages.author, 'planner')))
      .run();
  return {
    chain: database.db.select().from(chains).where(eq(chains.id, existing.id)).get()!,
    created: false,
  };
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
          inArray(chains.kind, ['question', 'message', 'rumble', 'unlock']),
          or(isNull(chains.snoozedUntil), lt(chains.snoozedUntil, now)),
        ),
      )
      .get()?.value ?? 0
  );
}
