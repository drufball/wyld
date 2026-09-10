import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { Quest, QuestLink, World, type NewEvent } from '@wyld/shared';
import { z } from 'zod';

import type { AppDatabase } from './database.js';
import { deriveProgress } from './progress.js';
import { questLinks, questNotes, quests, worlds } from './schema.js';
import { formatIssues } from './validation.js';

const QuestStatus = Quest.shape.status;
const QuestCreate = Quest.omit({ progress: true }).partial({
  status: true,
  sinceYouLooked: true,
  lastNote: true,
});
const QuestPatch = z
  .object({
    status: QuestStatus.optional(),
    sinceYouLooked: z.string().optional(),
    lastNote: z.string().optional(),
    source: z.enum(['planner', 'human']).default('planner'),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.sinceYouLooked !== undefined ||
      value.lastNote !== undefined,
    {
      message: 'At least one field must be updated',
    },
  );
const QuestQuery = z.object({
  world: z.string().min(1).optional(),
  status: QuestStatus.optional(),
});
const LinkCreate = QuestLink.omit({ questId: true });
const NoteCreate = z
  .object({
    author: z.enum(['planner', 'human']),
    text: z.string().min(1),
    intent: z.enum(['nudge', 'ask']).optional(),
  })
  .superRefine((value, context) => {
    if (value.author === 'planner' && value.intent !== undefined)
      context.addIssue({
        code: 'custom',
        path: ['intent'],
        message: 'Intent is only valid for human notes',
      });
  });
const NoteQuery = z.object({ limit: z.coerce.number().int().positive().max(200).default(50) });
const statuses = QuestStatus.options;

type Dependencies = {
  database: AppDatabase;
  now: () => Date;
  storeEvent: (event: NewEvent) => Promise<unknown>;
};

export function createQuestRoutes({ database: { db }, now, storeEvent }: Dependencies) {
  const app = new Hono();
  const notFound = (c: Context) => c.json({ error: 'Not Found' }, 404);
  const readQuest = (id: string) => {
    const row = db.select().from(quests).where(eq(quests.id, id)).get();
    if (row === undefined) return undefined;
    const links = db.select().from(questLinks).where(eq(questLinks.questId, id)).all();
    return Quest.parse({ ...row, progress: deriveProgress(row.status, links) });
  };

  app.get('/worlds', (c) => {
    const rows = db.select().from(worlds).orderBy(asc(worlds.order), asc(worlds.id)).all();
    const allQuests = db
      .select({ worldId: quests.worldId, status: quests.status })
      .from(quests)
      .all();
    return c.json(
      rows.map((world) => {
        const questCounts = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<
          (typeof statuses)[number],
          number
        >;
        for (const quest of allQuests) if (quest.worldId === world.id) questCounts[quest.status]++;
        return { ...World.parse(world), questCounts };
      }),
    );
  });

  app.post('/worlds', async (c) => {
    const parsed = World.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    db.insert(worlds)
      .values(parsed.data)
      .onConflictDoUpdate({ target: worlds.id, set: parsed.data })
      .run();
    await storeEvent({
      source: 'planner',
      kind: 'planner.world_updated',
      payload: { worldId: parsed.data.id, name: parsed.data.name },
    });
    return c.json(parsed.data);
  });

  app.get('/quests', (c) => {
    const parsed = QuestQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    if (
      parsed.data.world !== undefined &&
      db.select().from(worlds).where(eq(worlds.id, parsed.data.world)).get() === undefined
    )
      return notFound(c);
    const clauses = [
      parsed.data.world === undefined ? undefined : eq(quests.worldId, parsed.data.world),
      parsed.data.status === undefined ? undefined : eq(quests.status, parsed.data.status),
    ].filter((clause) => clause !== undefined);
    const rows = db
      .select()
      .from(quests)
      .where(clauses.length === 0 ? undefined : and(...clauses))
      .orderBy(asc(quests.id))
      .all();
    const linksByQuest = new Map<string, QuestLink[]>();
    if (rows.length > 0) {
      const links = db
        .select()
        .from(questLinks)
        .where(
          inArray(
            questLinks.questId,
            rows.map((row) => row.id),
          ),
        )
        .all();
      for (const link of links) {
        const parsedLink = QuestLink.parse(link);
        const grouped = linksByQuest.get(link.questId) ?? [];
        grouped.push(parsedLink);
        linksByQuest.set(link.questId, grouped);
      }
    }
    return c.json(
      rows.map((row) =>
        Quest.parse({
          ...row,
          progress: deriveProgress(row.status, linksByQuest.get(row.id) ?? []),
        }),
      ),
    );
  });

  app.get('/quests/:id', (c) => {
    const quest = readQuest(c.req.param('id'));
    return quest === undefined ? notFound(c) : c.json(quest);
  });

  app.post('/quests', async (c) => {
    const parsed = QuestCreate.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    if (db.select().from(worlds).where(eq(worlds.id, parsed.data.worldId)).get() === undefined)
      return notFound(c);
    const value = {
      ...parsed.data,
      status: parsed.data.status ?? ('idea' as const),
      sinceYouLooked: parsed.data.sinceYouLooked ?? '',
      lastNote: parsed.data.lastNote ?? '',
    };
    db.insert(quests)
      .values(value)
      .onConflictDoUpdate({ target: quests.id, set: parsed.data })
      .run();
    const updated = readQuest(value.id);
    if (updated === undefined) throw new Error('Quest upsert did not return a quest');
    await storeEvent({
      source: 'planner',
      kind: 'planner.quest_updated',
      questId: updated.id,
      payload: { summary: `Quest "${updated.title}" is now ${updated.status}`, ...updated },
    });
    return c.json(updated);
  });

  app.patch('/quests/:id', async (c) => {
    const current = db
      .select()
      .from(quests)
      .where(eq(quests.id, c.req.param('id')))
      .get();
    if (current === undefined) return notFound(c);
    const parsed = QuestPatch.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const { source, ...changes } = parsed.data;
    db.update(quests).set(changes).where(eq(quests.id, current.id)).run();
    const updated = readQuest(current.id)!;
    const parks =
      source === 'human' &&
      changes.status !== undefined &&
      (changes.status === 'parked' || current.status === 'parked');
    await storeEvent(
      parks
        ? {
            source: 'human',
            kind: 'human.park',
            questId: current.id,
            payload: {
              text: `${changes.status === 'parked' ? 'Park' : 'Unpark'}: ${current.title}`,
            },
          }
        : {
            source: 'planner',
            kind: 'planner.quest_updated',
            questId: current.id,
            payload: {
              summary:
                changes.status === undefined
                  ? `Quest "${current.title}" was updated`
                  : `Quest "${current.title}" is now ${changes.status}`,
              ...changes,
            },
          },
    );
    return c.json(updated);
  });

  app.post('/quests/:id/links', async (c) => {
    const id = c.req.param('id');
    if (readQuest(id) === undefined) return notFound(c);
    const parsed = LinkCreate.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const value = { questId: id, ...parsed.data };
    db.insert(questLinks)
      .values(value)
      .onConflictDoUpdate({
        target: [questLinks.questId, questLinks.ghKind, questLinks.ghRef],
        set: { state: value.state },
      })
      .run();
    await storeEvent({
      source: 'planner',
      kind: 'planner.quest_updated',
      questId: id,
      payload: { summary: 'Progress updated' },
    });
    return c.json(QuestLink.parse(value));
  });

  app.get('/quests/:id/links', (c) => {
    if (c.req.header('X-Planner') !== '1') return notFound(c);
    const id = c.req.param('id');
    if (readQuest(id) === undefined) return notFound(c);
    return c.json(
      db
        .select()
        .from(questLinks)
        .where(eq(questLinks.questId, id))
        .orderBy(asc(questLinks.id))
        .all()
        .map((row) => QuestLink.parse(row)),
    );
  });

  app.post('/quests/:id/notes', async (c) => {
    const id = c.req.param('id');
    if (readQuest(id) === undefined) return notFound(c);
    const parsed = NoteCreate.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const ts = now().toISOString();
    const [row] = db
      .insert(questNotes)
      .values({ questId: id, author: parsed.data.author, text: parsed.data.text, ts })
      .returning()
      .all();
    if (row === undefined) throw new Error('Note insert did not return a row');
    db.update(quests).set({ lastNote: parsed.data.text }).where(eq(quests.id, id)).run();
    const kind =
      parsed.data.author === 'planner'
        ? 'planner.note'
        : parsed.data.intent === 'nudge'
          ? 'human.nudge'
          : 'human.ask';
    await storeEvent({
      source: parsed.data.author,
      kind,
      questId: id,
      payload: { text: parsed.data.text },
    });
    return c.json({
      id: row.id,
      questId: row.questId,
      author: row.author,
      text: row.text,
      ts: row.ts,
    });
  });

  app.get('/quests/:id/notes', (c) => {
    const id = c.req.param('id');
    if (readQuest(id) === undefined) return notFound(c);
    const parsed = NoteQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const rows = db
      .select()
      .from(questNotes)
      .where(eq(questNotes.questId, id))
      .orderBy(desc(questNotes.id))
      .limit(parsed.data.limit)
      .all()
      .reverse();
    return c.json(rows);
  });

  return app;
}
