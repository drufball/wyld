import { asc, desc, eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import {
  ARTIFACT_SLUG,
  Artifact,
  ArtifactWithHtml,
  NewArtifact,
  type NewEvent,
} from '@wyld/shared';
import { z } from 'zod';

import type { AppDatabase } from './database.js';
import { formatIssues } from './quests.js';
import { artifacts, quests } from './schema.js';

type Dependencies = {
  database: AppDatabase;
  now: () => Date;
  storeEvent: (event: NewEvent) => Promise<unknown>;
};
const ArtifactQuery = z.object({ quest: z.string().min(1).optional() });
const metadata = (row: typeof artifacts.$inferSelect) => Artifact.parse(row);
const notFound = (c: Context) => c.json({ error: 'Not Found' }, 404);

export function createArtifactRoutes({ database: { db }, now, storeEvent }: Dependencies) {
  const app = new Hono();
  app.get('/artifacts', (c) => {
    const parsed = ArtifactQuery.safeParse(c.req.query());
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    if (
      parsed.data.quest !== undefined &&
      db.select().from(quests).where(eq(quests.id, parsed.data.quest)).get() === undefined
    )
      return notFound(c);
    const rows = db
      .select()
      .from(artifacts)
      .where(parsed.data.quest === undefined ? undefined : eq(artifacts.questId, parsed.data.quest))
      .orderBy(desc(artifacts.updatedAt), asc(artifacts.slug))
      .all();
    return c.json(rows.map(metadata));
  });
  app.get('/artifacts/:slug', (c) => {
    const slug = c.req.param('slug');
    if (!ARTIFACT_SLUG.test(slug)) return notFound(c);
    const row = db.select().from(artifacts).where(eq(artifacts.slug, slug)).get();
    return row === undefined ? notFound(c) : c.json(ArtifactWithHtml.parse(row));
  });
  app.post('/artifacts', async (c) => {
    const parsed = NewArtifact.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json(formatIssues(parsed.error), 400);
    const questId = parsed.data.questId ?? null;
    if (
      questId !== null &&
      db.select().from(quests).where(eq(quests.id, questId)).get() === undefined
    )
      return notFound(c);
    const existing = db.select().from(artifacts).where(eq(artifacts.slug, parsed.data.slug)).get();
    const ts = now().toISOString();
    const version = (existing?.version ?? 0) + 1;
    db.insert(artifacts)
      .values({ ...parsed.data, questId, version, createdAt: ts, updatedAt: ts })
      .onConflictDoUpdate({
        target: artifacts.slug,
        set: {
          title: parsed.data.title,
          summary: parsed.data.summary,
          html: parsed.data.html,
          questId,
          version,
          updatedAt: ts,
        },
      })
      .run();
    const row = db.select().from(artifacts).where(eq(artifacts.slug, parsed.data.slug)).get()!;
    await storeEvent({
      source: 'planner',
      kind: 'planner.artifact_published',
      ...(questId === null ? {} : { questId }),
      payload: { slug: row.slug, title: row.title, questId, version },
    });
    return c.json(metadata(row), 201);
  });
  app.delete('/artifacts/:slug', (c) => {
    const slug = c.req.param('slug');
    if (!ARTIFACT_SLUG.test(slug)) return notFound(c);
    const result = db.delete(artifacts).where(eq(artifacts.slug, slug)).run();
    return result.changes === 0 ? notFound(c) : c.body(null, 204);
  });
  return app;
}

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
export function createArtifactServeRoutes({ database: { db } }: Dependencies) {
  const app = new Hono();
  app.all('/artifacts/:slug', (c) => {
    const slug = c.req.param('slug');
    if (!ARTIFACT_SLUG.test(slug) || (c.req.method !== 'GET' && c.req.method !== 'HEAD'))
      return notFound(c);
    if (db.select().from(artifacts).where(eq(artifacts.slug, slug)).get() === undefined)
      return notFound(c);
    return c.redirect(`/artifacts/${slug}/`, 301);
  });
  app.all('/artifacts/:slug/', (c) => {
    const slug = c.req.param('slug');
    if (!ARTIFACT_SLUG.test(slug) || (c.req.method !== 'GET' && c.req.method !== 'HEAD'))
      return notFound(c);
    const row = db.select().from(artifacts).where(eq(artifacts.slug, slug)).get();
    if (row === undefined) return notFound(c);
    c.header('Content-Type', 'text/html; charset=utf-8');
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Content-Security-Policy', CSP);
    return c.req.method === 'HEAD' ? c.body(null) : c.body(row.html);
  });
  return app;
}
