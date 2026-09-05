import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const events = sqliteTable(
  'events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ts: text('ts').notNull(),
    source: text('source').notNull(),
    kind: text('kind').notNull(),
    payload: text('payload', { mode: 'json' }).notNull(),
    questId: text('quest_id'),
  },
  (table) => [index('events_ts_idx').on(table.ts), index('events_quest_id_idx').on(table.questId)],
);

export const presence = sqliteTable('presence', {
  id: integer('id').primaryKey(),
  lastSeenAt: text('last_seen_at').notNull(),
  lastCatchupEventId: integer('last_catchup_event_id'),
  nextActionText: text('next_action_text'),
  nextActionLink: text('next_action_link'),
});
