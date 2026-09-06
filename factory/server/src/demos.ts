import fs from 'node:fs/promises';
import path from 'node:path';

import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { Demo, Feedback, NewDemo, NewFeedback, type NewEvent } from '@wyld/shared';
import { z } from 'zod';

import { DEMO_SLUG, type DemoBuilder } from './builder.js';
import type { Config } from './config.js';
import type { AppDatabase } from './database.js';
import type { LogContext } from './logger.js';
import { formatIssues } from './quests.js';
import { demos, feedback, quests } from './schema.js';

type Dependencies = {
  database: AppDatabase;
  now: () => Date;
  storeEvent: (event: NewEvent) => Promise<unknown>;
  config: Pick<Config, 'feedbackDir'>;
  builder: DemoBuilder;
  logger: (level: 'info' | 'error', message: string, context?: LogContext) => void;
};
const BuildRequest = z.object({ id: z.string().optional() });
const FeedbackQuery = z.object({ demo: z.string().optional() });

const parseDemo = (row: typeof demos.$inferSelect) =>
  Demo.parse({
    ...row,
    steps: row.steps ?? [],
    seeded: row.seeded ?? [],
    url:
      row.kind === 'live'
        ? (row.deepLink ?? '/')
        : `/play/${row.id}/${(row.deepLink ?? '/').replace(/^\//, '')}`,
  });
const parseFeedback = (row: typeof feedback.$inferSelect) =>
  Feedback.parse({ ...row, hasScreenshot: row.screenshotPath !== null });
const validSlug = (value: string) => DEMO_SLUG.test(value);

export function createDemoRoutes({
  database,
  now,
  storeEvent,
  config,
  builder,
  logger,
}: Dependencies) {
  const { db } = database;
  const app = new Hono();

  const finishBuild = (id: string, promise: ReturnType<DemoBuilder['build']>) => {
    void promise
      .then((result) => {
        db.update(demos)
          .set(
            result.ok
              ? { status: 'ready', builtAt: now().toISOString(), error: null }
              : { status: 'failed', error: result.error },
          )
          .where(eq(demos.id, id))
          .run();
      })
      .catch((error: unknown) => {
        logger('error', 'failed to record demo build result', { id, error: String(error) });
      });
  };

  app.get('/demos', (c) => {
    const rows = db
      .select()
      .from(demos)
      .all()
      .sort((a, b) => {
        if (a.id === 'main' || b.id === 'main') return a.id === 'main' ? -1 : 1;
        if (a.builtAt === null && b.builtAt === null) return a.id.localeCompare(b.id);
        if (a.builtAt === null) return -1;
        if (b.builtAt === null) return 1;
        return b.builtAt.localeCompare(a.builtAt) || a.id.localeCompare(b.id);
      });
    return c.json(rows.map(parseDemo));
  });

  app.post('/demos', async (c) => {
    const parsed = NewDemo.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    if (!validSlug(parsed.data.id)) return c.json({ error: 'Invalid demo slug' }, 400);
    const quest = parsed.data.questId
      ? db.select().from(quests).where(eq(quests.id, parsed.data.questId)).get()
      : undefined;
    const title =
      parsed.data.title ?? quest?.title ?? (parsed.data.id === 'main' ? 'Main' : parsed.data.id);
    const kind = parsed.data.kind ?? 'disc';
    const live = kind === 'live';
    const builtAt = live ? now().toISOString() : null;
    db.insert(demos)
      .values({
        id: parsed.data.id,
        ref: parsed.data.ref,
        questId: parsed.data.questId ?? null,
        title,
        kind,
        summary: parsed.data.summary ?? null,
        steps: parsed.data.steps ?? [],
        seeded: parsed.data.seeded ?? [],
        deepLink: parsed.data.deepLink ?? null,
        status: live ? 'ready' : 'building',
        builtAt,
        error: null,
      })
      .onConflictDoUpdate({
        target: demos.id,
        set: {
          ref: parsed.data.ref,
          questId: parsed.data.questId ?? null,
          title,
          kind,
          summary: parsed.data.summary ?? null,
          steps: parsed.data.steps ?? [],
          seeded: parsed.data.seeded ?? [],
          deepLink: parsed.data.deepLink ?? null,
          status: live ? 'ready' : 'building',
          builtAt,
          error: null,
        },
      })
      .run();
    if (!live)
      finishBuild(
        parsed.data.id,
        kind === 'pak'
          ? builder.build(parsed.data.id, parsed.data.ref, 'pak')
          : builder.build(parsed.data.id, parsed.data.ref),
      );
    return c.json(
      parseDemo(db.select().from(demos).where(eq(demos.id, parsed.data.id)).get()!),
      201,
    );
  });

  app.post('/demos/build', async (c) => {
    const body: unknown = await c.req.json().catch(() => ({}));
    const parsed = BuildRequest.safeParse(body);
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const id = parsed.data.id ?? 'main';
    if (!validSlug(id)) return c.json({ error: 'Invalid demo slug' }, 400);
    let row = db.select().from(demos).where(eq(demos.id, id)).get();
    if (row === undefined && id !== 'main') return c.json({ error: 'Demo not found' }, 404);
    if (row === undefined) {
      db.insert(demos)
        .values({
          id,
          ref: 'main',
          questId: null,
          title: 'Main',
          status: 'building',
          builtAt: null,
          error: null,
        })
        .run();
      row = db.select().from(demos).where(eq(demos.id, id)).get()!;
    }
    if (row.kind === 'live') return c.json({ error: 'Live demos are not built' }, 400);
    if (!builder.isBuilding(id)) {
      db.update(demos).set({ status: 'building', error: null }).where(eq(demos.id, id)).run();
      finishBuild(
        id,
        row.kind === 'pak' ? builder.build(id, row.ref, 'pak') : builder.build(id, row.ref),
      );
    }
    return c.json(parseDemo(db.select().from(demos).where(eq(demos.id, id)).get()!), 202);
  });

  app.get('/feedback', (c) => {
    const parsed = FeedbackQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    if (parsed.data.demo !== undefined && !validSlug(parsed.data.demo))
      return c.json({ error: 'Invalid demo slug' }, 400);
    const rows =
      parsed.data.demo === undefined
        ? db.select().from(feedback).orderBy(desc(feedback.created), desc(feedback.id)).all()
        : db
            .select()
            .from(feedback)
            .where(eq(feedback.demoId, parsed.data.demo))
            .orderBy(desc(feedback.created), desc(feedback.id))
            .all();
    return c.json(rows.map(parseFeedback));
  });

  app.post('/feedback', async (c) => {
    const parsed = NewFeedback.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    if (!validSlug(parsed.data.demoId)) return c.json({ error: 'Invalid demo slug' }, 400);
    const demo = db.select().from(demos).where(eq(demos.id, parsed.data.demoId)).get();
    if (demo === undefined) return c.json({ error: 'Demo not found' }, 404);
    let image: { extension: 'jpg' | 'png'; bytes: Buffer } | undefined;
    if (parsed.data.screenshot !== undefined) {
      const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]*={0,2})$/.exec(
        parsed.data.screenshot,
      );
      if (match === null) return c.json({ error: 'Invalid screenshot' }, 400);
      const bytes = Buffer.from(match[2]!, 'base64');
      if (bytes.byteLength > 4 * 1024 * 1024)
        return c.json({ error: 'Screenshot exceeds 4 MB' }, 400);
      image = { extension: match[1] === 'jpeg' ? 'jpg' : 'png', bytes };
    }
    const created = now().toISOString();
    const [row] = db
      .insert(feedback)
      .values({
        demoId: demo.id,
        questId: demo.questId,
        text: parsed.data.text,
        state: parsed.data.state ?? null,
        screenshotPath: null,
        created,
      })
      .returning()
      .all();
    if (row === undefined) throw new Error('Feedback insert did not return a row');
    let stored = row;
    if (image !== undefined) {
      await fs.mkdir(config.feedbackDir, { recursive: true });
      const fileName = `${row.id}.${image.extension}`;
      await fs.writeFile(path.join(config.feedbackDir, fileName), image.bytes);
      db.update(feedback).set({ screenshotPath: fileName }).where(eq(feedback.id, row.id)).run();
      stored = { ...row, screenshotPath: fileName };
    }
    await storeEvent({
      source: 'human',
      kind: 'human.feedback',
      ...(demo.questId === null ? {} : { questId: demo.questId }),
      payload: {
        text: row.text,
        demo: demo.title,
        demoId: demo.id,
        feedbackId: row.id,
        hasScreenshot: image !== undefined,
        ...(parsed.data.state === undefined ? {} : { state: parsed.data.state }),
      },
    });
    return c.json(parseFeedback(stored), 201);
  });

  app.get('/feedback/:id/screenshot', async (c) => {
    const id = z.coerce.number().int().positive().safeParse(c.req.param('id'));
    if (!id.success) return c.json(formatIssues(id.error), 400);
    const row = db.select().from(feedback).where(eq(feedback.id, id.data)).get();
    if (row?.screenshotPath === null || row === undefined)
      return c.json({ error: 'Not Found' }, 404);
    try {
      const bytes = await fs.readFile(path.join(config.feedbackDir, row.screenshotPath));
      return new Response(bytes, {
        headers: {
          'content-type': row.screenshotPath.endsWith('.png') ? 'image/png' : 'image/jpeg',
        },
      });
    } catch {
      return c.json({ error: 'Not Found' }, 404);
    }
  });

  return app;
}
