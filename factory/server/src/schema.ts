import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { SleepAlarm, SleepPhaseEntry } from '@wyld/shared';

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

export const sleepRuns = sqliteTable(
  'sleep_runs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    started: text('started').notNull(),
    ended: text('ended'),
    trigger: text('trigger', { enum: ['human', 'schedule'] }).notNull(),
    phases: text('phases', { mode: 'json' }).$type<SleepPhaseEntry[]>().notNull().default([]),
    alarmsFired: text('alarms_fired', { mode: 'json' }).$type<SleepAlarm[]>().notNull().default([]),
    outcome: text('outcome', { enum: ['clean', 'timed_out', 'paused'] }),
    leftoversParked: text('leftovers_parked', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default([]),
  },
  (table) => [index('sleep_runs_ended_idx').on(table.ended)],
);

export const retros = sqliteTable(
  'retros',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull(),
    summary: text('summary').notNull(),
    wins: text('wins', { mode: 'json' }).$type<string[]>().notNull(),
    misses: text('misses', { mode: 'json' }).$type<string[]>().notNull(),
    factoryImprovements: text('factory_improvements', { mode: 'json' }).$type<string[]>().notNull(),
    stats: text('stats', { mode: 'json' }).$type<Record<string, number>>().notNull(),
    generatedBy: text('generated_by', { enum: ['planner', 'mechanical'] }).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('retros_date_unique').on(table.date)],
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

export const pauses = sqliteTable(
  'pauses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    lane: text('lane').notNull(),
    reason: text('reason').notNull(),
    fix: text('fix'),
    since: text('since').notNull(),
    resolvedAt: text('resolved_at'),
    rumbleId: text('rumble_id'),
  },
  (table) => [index('pauses_resolved_at_idx').on(table.resolvedAt)],
);

export const presence = sqliteTable('presence', {
  id: integer('id').primaryKey(),
  lastSeenAt: text('last_seen_at').notNull(),
  lastCatchupEventId: integer('last_catchup_event_id'),
  nextActionText: text('next_action_text'),
  nextActionLink: text('next_action_link'),
  nextActionBackAt: text('next_action_back_at'),
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
    kind: text('kind', { enum: ['question', 'message', 'rumble'] })
      .notNull()
      .default('question'),
    status: text('status', { enum: ['open', 'settled', 'converted'] }).notNull(),
    createdAt: text('created_at').notNull(),
    lastActivityAt: text('last_activity_at').notNull(),
    questId: text('quest_id'),
    snoozedUntil: text('snoozed_until'),
    slug: text('slug'),
    title: text('title'),
    context: text('context'),
    options: text('options', { mode: 'json' }).$type<string[]>(),
    chosen: text('chosen'),
    chosenAt: text('chosen_at'),
    blockingQuestIds: text('blocking_quest_ids', { mode: 'json' }).$type<string[]>(),
    rumbleKind: text('rumble_kind', {
      enum: ['account', 'money', 'model', 'taste', 'scope', 'outage'],
    }),
  },
  (table) => [
    index('chains_status_activity_idx').on(table.status, table.lastActivityAt),
    index('chains_kind_idx').on(table.kind),
    uniqueIndex('chains_slug_unique').on(table.slug),
  ],
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

export const demos = sqliteTable('demos', {
  id: text('id').primaryKey(),
  questId: text('quest_id'),
  title: text('title').notNull(),
  ref: text('ref').notNull(),
  kind: text('kind', { enum: ['disc', 'live', 'pak'] })
    .notNull()
    .default('disc'),
  summary: text('summary'),
  steps: text('steps', { mode: 'json' }).$type<string[]>(),
  seeded: text('seeded', { mode: 'json' }).$type<string[]>(),
  deepLink: text('deep_link'),
  status: text('status', { enum: ['building', 'ready', 'failed'] }).notNull(),
  builtAt: text('built_at'),
  error: text('error'),
});

export const feedback = sqliteTable(
  'feedback',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    demoId: text('demo_id').notNull(),
    questId: text('quest_id'),
    text: text('text').notNull(),
    state: text('state', { mode: 'json' }).$type<Record<string, unknown>>(),
    screenshotPath: text('screenshot_path'),
    created: text('created').notNull(),
  },
  (table) => [index('feedback_demo_id_idx').on(table.demoId)],
);
