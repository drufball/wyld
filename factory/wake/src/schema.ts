import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const messages = sqliteTable(
  'messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ts: text('ts').notNull(),
    source: text('source').notNull(),
    kind: text('kind').notNull(),
    quest: text('quest'),
    issue: integer('issue'),
    pr: integer('pr'),
    chain: integer('chain'),
    run: integer('run'),
    url: text('url'),
    summary: text('summary').notNull(),
    count: integer('count').notNull().default(1),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deliveredAt: text('delivered_at'),
  },
  (table) => [index('messages_delivered_at_idx').on(table.deliveredAt)],
);

export const wakeState = sqliteTable('wake_state', {
  id: integer('id').primaryKey(),
  pausedSince: text('paused_since'),
});
