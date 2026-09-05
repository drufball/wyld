import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from './schema.js';

export type AppDatabase = {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: Database.Database;
};

export function openDatabase(databasePath: string, migrationsFolder: string): AppDatabase {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO presence
       (id, last_seen_at, last_catchup_event_id, next_action_text, next_action_link)
       VALUES (1, ?, NULL, NULL, NULL)`,
    )
    .run(new Date().toISOString());
  return { db, sqlite };
}
