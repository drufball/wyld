import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { Achievement, type Event, type NewEvent } from '@wyld/shared';

import type { AppDatabase } from './database.js';
import { achievements, chains, events, feedback, quests, retros, sleepRuns } from './schema.js';
import { createUnlockChain } from './chain-cards.js';

export const ACHIEVEMENT_CATALOGUE = [
  {
    id: 'first-quest-done',
    name: 'First Light',
    description: 'Marked your first quest done.',
    badge: '✨',
  },
  { id: 'five-done', name: 'Five Alive', description: 'Five quests done.', badge: '🖐️' },
  {
    id: 'first-feedback',
    name: 'Playtester',
    description: 'Left your first note on a demo.',
    badge: '📝',
  },
  {
    id: 'first-night',
    name: 'Night Shift',
    description: 'The factory ran a night clean through.',
    badge: '🌙',
  },
  { id: 'first-rumble', name: 'Decider', description: 'Settled your first Rumble.', badge: '⚖️' },
  { id: 'early-bird', name: 'Early Bird', description: 'Opened the Pak before 7am.', badge: '🐦' },
  {
    id: 'streak-3',
    name: 'Three in a Row',
    description: 'Three nights running with a Memory Card.',
    badge: '🔥',
  },
] as const;

function hasThreeDayStreak(dates: string[]) {
  let run = 1;
  for (let index = 1; index < dates.length; index += 1) {
    const parts = dates[index - 1]!.split('-').map(Number);
    const next = dates[index]!.split('-').map(Number);
    const newer = Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!);
    const older = Date.UTC(next[0]!, next[1]! - 1, next[2]!);
    run = newer - older === 86_400_000 ? run + 1 : 1;
    if (run >= 3) return true;
  }
  return false;
}

export function createAchievements(options: {
  database: AppDatabase;
  now: () => Date;
  storeEvent: (event: NewEvent) => Promise<Event>;
  timeZone: string;
}) {
  const { db } = options.database;
  const seed = () => {
    for (const item of ACHIEVEMENT_CATALOGUE) {
      db.insert(achievements)
        .values(item)
        .onConflictDoUpdate({
          target: achievements.id,
          set: { name: item.name, description: item.description, badge: item.badge },
        })
        .run();
    }
  };
  const list = (): Achievement[] => {
    const rows = new Map(
      db
        .select()
        .from(achievements)
        .all()
        .map((row) => [row.id, row]),
    );
    return ACHIEVEMENT_CATALOGUE.map(({ id }) => Achievement.parse(rows.get(id)));
  };
  const qualifies = (id: string) => {
    if (id === 'first-quest-done' || id === 'five-done') {
      const count = db
        .select({ id: quests.id })
        .from(quests)
        .where(eq(quests.status, 'done'))
        .limit(id === 'five-done' ? 5 : 1)
        .all().length;
      return count >= (id === 'five-done' ? 5 : 1);
    }
    if (id === 'first-feedback')
      return db.select({ id: feedback.id }).from(feedback).limit(1).all().length > 0;
    if (id === 'first-night')
      return (
        db
          .select({ id: sleepRuns.id })
          .from(sleepRuns)
          .where(eq(sleepRuns.outcome, 'clean'))
          .limit(1)
          .all().length > 0
      );
    if (id === 'first-rumble')
      return (
        db
          .select({ id: chains.id })
          .from(chains)
          .where(and(eq(chains.kind, 'rumble'), isNotNull(chains.chosen)))
          .limit(1)
          .all().length > 0
      );
    if (id === 'early-bird') {
      const row = db
        .select({ ts: events.ts })
        .from(events)
        .where(eq(events.kind, 'human.seen'))
        .orderBy(desc(events.id))
        .limit(1)
        .get();
      if (!row) return false;
      const hour = new Intl.DateTimeFormat('en-GB', {
        timeZone: options.timeZone,
        hour: '2-digit',
        hour12: false,
      }).format(new Date(row.ts));
      return Number(hour) < 7;
    }
    if (id === 'streak-3') {
      const dates = db
        .select({ date: retros.date })
        .from(retros)
        .orderBy(desc(retros.date))
        .limit(90)
        .all()
        .map(({ date }) => date);
      return hasThreeDayStreak(dates);
    }
    return false;
  };
  const evaluate = async (): Promise<Achievement[]> => {
    const unlocked: Achievement[] = [];
    const created: Array<{
      chain: ReturnType<typeof createUnlockChain>;
      achievement: Achievement;
    }> = [];
    for (const item of list().filter(({ unlockedAt }) => unlockedAt === null)) {
      if (!qualifies(item.id)) continue;
      const unlockedAt = options.now().toISOString();
      const changed = db
        .update(achievements)
        .set({ unlockedAt })
        .where(and(eq(achievements.id, item.id), isNull(achievements.unlockedAt)))
        .returning()
        .get();
      if (!changed) continue;
      const achievement = Achievement.parse(changed);
      unlocked.push(achievement);
      const chain = createUnlockChain(options.database, achievement, unlockedAt);
      created.push({ chain, achievement });
      await options.storeEvent({
        source: 'pak',
        kind: 'pak.achievement_unlocked',
        payload: { id: achievement.id, name: achievement.name, badge: achievement.badge },
      });
    }
    for (const { chain, achievement } of created) {
      await options.storeEvent({
        source: 'planner',
        kind: 'planner.chain_updated',
        payload: {
          chainId: chain.id,
          text: `Achievement unlocked — ${achievement.name}`,
        },
      });
    }
    return unlocked;
  };
  return { seed, list, evaluate };
}
