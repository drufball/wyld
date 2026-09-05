import fs from 'node:fs';
import path from 'node:path';

import type { WakeMessage } from '@wyld/shared';
import Database from 'better-sqlite3';
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from './schema.js';
import { messages } from './schema.js';

export type AppDatabase = { db: BetterSQLite3Database<typeof schema>; sqlite: Database.Database };

export function openDatabase(databasePath: string, migrationsFolder: string): AppDatabase {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return { db, sqlite };
}

export function enqueueMessage(database: AppDatabase, message: WakeMessage, now: Date): number {
  const target =
    message.kind === 'human.question' || message.kind === 'human.chain_closed'
      ? undefined
      : message.pr !== undefined
        ? (['pr', message.pr] as const)
        : message.issue !== undefined
          ? (['issue', message.issue] as const)
          : message.quest !== undefined
            ? (['quest', message.quest] as const)
            : undefined;
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - 60_000).toISOString();
  if (target !== undefined) {
    const column =
      target[0] === 'pr' ? messages.pr : target[0] === 'issue' ? messages.issue : messages.quest;
    const existing = database.db
      .select()
      .from(messages)
      .where(
        and(
          isNull(messages.deliveredAt),
          eq(messages.kind, message.kind),
          eq(column, target[1]),
          gte(messages.updatedAt, cutoff),
        ),
      )
      .orderBy(desc(messages.updatedAt))
      .get();
    if (existing !== undefined) {
      const count = existing.count + 1;
      database.db
        .update(messages)
        .set({
          count,
          updatedAt: nowIso,
          ts: message.ts,
          summary: `${message.summary} (+${count - 1} earlier updates)`,
        })
        .where(eq(messages.id, existing.id))
        .run();
      return existing.id;
    }
  }
  const row = database.db
    .insert(messages)
    .values({ ...message, createdAt: nowIso, updatedAt: nowIso })
    .returning({ id: messages.id })
    .get();
  return row.id;
}
