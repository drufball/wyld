import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

export const healthReports = sqliteTable(
  'health',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ts: text('ts').notNull(),
    plannerState: text('planner_state').notNull(),
    currentTask: text('current_task'),
    wakeQueueDepth: integer('wake_queue_depth'),
    ghRateRemaining: integer('gh_rate_remaining'),
    ciState: text('ci_state'),
    costToday: real('cost_today'),
    codexPrsOpen: integer('codex_prs_open'),
    pausedReason: text('paused_reason'),
  },
  (table) => [index('health_ts_idx').on(table.ts)],
);

export const opsReports = sqliteTable(
  'ops_reports',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ts: text('ts').notNull(),
    ciState: text('ci_state').notNull(),
    ciDetail: text('ci_detail'),
    codexPrsOpen: integer('codex_prs_open').notNull(),
    ghRateRemaining: integer('gh_rate_remaining'),
    ghRateLimit: integer('gh_rate_limit'),
    tokensToday: integer('tokens_today'),
  },
  (table) => [index('ops_reports_ts_idx').on(table.ts)],
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

export const chains = sqliteTable(
  'chains',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    status: text('status', { enum: ['open', 'settled', 'converted'] }).notNull(),
    createdAt: text('created_at').notNull(),
    lastActivityAt: text('last_activity_at').notNull(),
    questId: text('quest_id'),
  },
  (table) => [index('chains_status_activity_idx').on(table.status, table.lastActivityAt)],
);

export const chainMessages = sqliteTable(
  'chain_messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    chainId: integer('chain_id')
      .notNull()
      .references(() => chains.id),
    author: text('author', { enum: ['human', 'planner'] }).notNull(),
    text: text('text').notNull(),
    ts: text('ts').notNull(),
  },
  (table) => [index('chain_messages_chain_id_idx').on(table.chainId)],
);

export const rumbles = sqliteTable(
  'rumbles',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    context: text('context').notNull(),
    options: text('options', { mode: 'json' }).notNull().$type<string[]>(),
    chosen: text('chosen'),
    chosenAt: text('chosen_at'),
    blockingQuestIds: text('blocking_quest_ids', { mode: 'json' }).notNull().$type<string[]>(),
    kind: text('kind', {
      enum: ['account', 'money', 'model', 'taste', 'scope', 'outage'],
    }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('rumbles_chosen_at_idx').on(table.chosenAt)],
);
