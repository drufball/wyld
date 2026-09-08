import { Event, type CatchupDigest, type DemoKind, type QuestStatus } from '@wyld/shared';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';

import type { AppDatabase } from './database.js';
import { demoUrl, readOpenBriefing, upsertBriefingChain } from './chain-cards.js';
import { chains, demos, events, healthReports, presence, quests } from './schema.js';
import { listOrderedRumbleRows } from './rumbles.js';

export const CATCHUP_AWAY_SECONDS = 7200;
export const CATCHUP_PLANNER_ALIVE_SECONDS = 900;

export type CatchupQuest = {
  id: string;
  worldId: string;
  title: string;
  status: QuestStatus;
};

export function plannerIsAlive(database: AppDatabase, now: Date): boolean {
  const cutoff = new Date(now.getTime() - CATCHUP_PLANNER_ALIVE_SECONDS * 1000).toISOString();
  return (
    database.db
      .select({ id: healthReports.id })
      .from(healthReports)
      .where(
        and(
          gt(healthReports.ts, cutoff),
          inArray(healthReports.plannerState, ['online', 'working']),
        ),
      )
      .get() !== undefined
  );
}

export function briefingDismissedRecently(database: AppDatabase, now: Date): boolean {
  const cutoff = new Date(now.getTime() - CATCHUP_AWAY_SECONDS * 1000).toISOString();
  return (
    database.db
      .select({ id: chains.id })
      .from(chains)
      .where(
        and(
          eq(chains.kind, 'briefing'),
          eq(chains.status, 'settled'),
          gt(chains.lastActivityAt, cutoff),
        ),
      )
      .get() !== undefined
  );
}

export function mechanicalDigest(input: {
  events: Event[];
  quests: CatchupQuest[];
  openRumbles?: { id: string; title: string }[];
  demos?: {
    id: string;
    questId: string | null;
    summary: string | null;
    kind: DemoKind;
    deepLink: string | null;
    url: string | null;
  }[];
}): CatchupDigest {
  const quests = new Map(input.quests.map((quest) => [quest.id, quest]));
  const demos = new Map<string, NonNullable<typeof input.demos>[number]>();
  for (const demo of [...(input.demos ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
    if (demo.questId !== null && !demos.has(demo.questId)) demos.set(demo.questId, demo);
  }
  const seen = {
    shipped: new Set<string>(),
    demos: new Set<string>(),
    parked: new Set<string>(),
    building: new Set<string>(),
  };
  const digest: CatchupDigest = { rumbles: [], demos: [], shipped: [], fyi: [] };
  digest.rumbles = (input.openRumbles ?? [])
    .slice(0, 8)
    .map(({ title }) => ({ text: title, deepLink: '/rumble' }));
  const paused: string[] = [];
  const resumed: string[] = [];
  const parked: string[] = [];
  const building: string[] = [];
  const addQuest = (section: keyof typeof seen, event: Event, status: QuestStatus) => {
    if (event.questId === undefined || seen[section].has(event.questId)) return;
    const quest = quests.get(event.questId);
    if (quest === undefined || quest.status !== status) return;
    seen[section].add(quest.id);
    if (section === 'shipped' && digest.shipped.length < 8)
      digest.shipped.push({ text: quest.title, deepLink: `/worlds/${quest.worldId}` });
    if (section === 'demos' && digest.demos.length < 8) {
      const demo = demos.get(quest.id);
      digest.demos.push({
        text: demo?.summary?.trim() ? demo.summary : quest.title,
        deepLink:
          demo === undefined
            ? '/demos'
            : demo.kind === 'live'
              ? (demo.deepLink ?? demo.url ?? '/demos').trim() || '/demos'
              : `/demos/${demo.id}`,
      });
    }
    if (section === 'parked') parked.push(`Parked: ${quest.title}.`);
    if (section === 'building') building.push(`Started building: ${quest.title}.`);
  };
  for (const event of input.events) {
    const status = event.payload.status;
    if (event.kind === 'planner.quest_updated' && status === 'done')
      addQuest('shipped', event, 'done');
    if (event.kind === 'planner.quest_updated' && status === 'demo')
      addQuest('demos', event, 'demo');
    if (event.kind === 'system.paused') {
      const reason =
        typeof event.payload.reason === 'string' && event.payload.reason.trim() !== ''
          ? event.payload.reason
          : 'something ran out';
      paused.push(`The factory paused — ${reason}.`);
    }
    if (event.kind === 'system.resumed') resumed.push('The factory is running again.');
    if (
      event.kind === 'human.park' ||
      (event.kind === 'planner.quest_updated' && status === 'parked')
    )
      addQuest('parked', event, 'parked');
    if (event.kind === 'planner.quest_updated' && status === 'building')
      addQuest('building', event, 'building');
  }
  digest.fyi = [...paused, ...resumed, ...parked, ...building].slice(0, 8);
  return digest;
}

export function ensureMechanicalBriefing(database: AppDatabase, now: Date): void {
  if (readOpenBriefing(database) !== undefined) return;
  const { db } = database;
  const currentPresence = db.select().from(presence).get();
  if (currentPresence === undefined) throw new Error('Presence row is missing');
  const from = currentPresence.lastCatchupEventId ?? 0;
  const to = db.select({ id: events.id }).from(events).orderBy(desc(events.id)).get()?.id ?? 0;
  const unseen = db
    .select()
    .from(events)
    .where(gt(events.id, from))
    .orderBy(events.id)
    .all()
    .map((event) => Event.parse({ ...event, questId: event.questId ?? undefined }));
  const awaySeconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(currentPresence.lastSeenAt).getTime()) / 1000),
  );
  if (
    awaySeconds <= CATCHUP_AWAY_SECONDS ||
    unseen.length === 0 ||
    briefingDismissedRecently(database, now) ||
    plannerIsAlive(database, now)
  )
    return;
  const digest = mechanicalDigest({
    events: unseen,
    quests: db
      .select({
        id: quests.id,
        worldId: quests.worldId,
        title: quests.title,
        status: quests.status,
      })
      .from(quests)
      .all(),
    demos: db
      .select({
        id: demos.id,
        questId: demos.questId,
        summary: demos.summary,
        kind: demos.kind,
        deepLink: demos.deepLink,
      })
      .from(demos)
      .all()
      .map((demo) => ({ ...demo, url: demoUrl(demo) })),
    openRumbles: listOrderedRumbleRows(database, 'open', { now: () => now }).map(
      ({ slug, title }) => ({ id: slug!, title: title! }),
    ),
  });
  upsertBriefingChain(database, { digest, fromEventId: from, toEventId: to }, now.toISOString());
}
