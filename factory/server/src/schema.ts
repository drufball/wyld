import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

export const catchups = sqliteTable(
  'catchups',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fromEventId: integer('from_event_id').notNull(),
    toEventId: integer('to_event_id').notNull(),
    digest: text('digest', { mode: 'json' }).notNull(),
    generatedBy: text('generated_by', { enum: ['planner', 'mechanical'] }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('catchups_range_generated_by_unique').on(
      table.fromEventId,
      table.toEventId,
      table.generatedBy,
    ),
  ],
);

export const worlds = sqliteTable('worlds', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['game', 'factory'] }).notNull(),
  order: integer('sort_order').notNull(),
  icon: text('icon').notNull(),
});

export const quests = sqliteTable(
  'quests',
  {
    id: text('id').primaryKey(),
    worldId: text('world_id')
      .notNull()
      .references(() => worlds.id),
    title: text('title').notNull(),
    pitch: text('pitch').notNull(),
    status: text('status', {
      enum: ['idea', 'planning', 'building', 'demo', 'done', 'parked'],
    }).notNull(),
    sinceYouLooked: text('since_you_looked').notNull().default(''),
    lastNote: text('last_note').notNull().default(''),
  },
  (table) => [index('quests_world_id_idx').on(table.worldId)],
);

export const questLinks = sqliteTable(
  'quest_links',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    questId: text('quest_id')
      .notNull()
      .references(() => quests.id),
    ghKind: text('gh_kind', { enum: ['issue', 'pr', 'branch'] }).notNull(),
    ghRef: text('gh_ref').notNull(),
    state: text('state').notNull(),
  },
  (table) => [
    uniqueIndex('quest_links_quest_kind_ref_unique').on(table.questId, table.ghKind, table.ghRef),
  ],
);

export const questNotes = sqliteTable(
  'quest_notes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    questId: text('quest_id')
      .notNull()
      .references(() => quests.id),
    author: text('author', { enum: ['planner', 'human'] }).notNull(),
    text: text('text').notNull(),
    ts: text('ts').notNull(),
  },
  (table) => [index('quest_notes_quest_id_idx').on(table.questId)],
);
