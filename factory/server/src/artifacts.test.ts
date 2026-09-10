import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { openDatabase, type AppDatabase } from './database.js';
import { quests, worlds } from './schema.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
const html = '<!doctype html><html><body>hello</body></html>';

describe('artifact routes', () => {
  let directory: string;
  let database: AppDatabase;
  let clock: Date;
  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-artifacts-'));
    database = openDatabase(path.join(directory, 'pak.sqlite'), migrations);
    clock = new Date('2026-09-07T12:00:00.000Z');
    app = createApp({
      database,
      demosDir: directory,
      feedbackDir: directory,
      now: () => clock,
      logger: () => undefined,
    });
  });
  afterEach(() => {
    database.sqlite.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const post = (body: unknown) =>
    app.request('/api/artifacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const body = (slug = 'roadmap') => ({ slug, title: 'Roadmap', summary: 'One line', html });

  it('lists metadata and upserts while preserving creation time', async () => {
    expect(await (await app.request('/api/artifacts')).json()).toEqual([]);
    const first = await post(body());
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({
      slug: 'roadmap',
      version: 1,
      createdAt: clock.toISOString(),
    });
    clock = new Date('2026-09-07T13:00:00.000Z');
    const second = await post({ ...body(), title: 'New' });
    expect(await second.json()).toMatchObject({
      title: 'New',
      version: 2,
      createdAt: '2026-09-07T12:00:00.000Z',
      updatedAt: clock.toISOString(),
    });
    const list = (await (await app.request('/api/artifacts')).json()) as Array<
      Record<string, unknown>
    >;
    expect(list[0]).not.toHaveProperty('html');
    expect(await (await app.request('/api/artifacts/roadmap')).json()).toMatchObject({ html });
    const events = (await (await app.request('/api/events')).json()) as Array<
      Record<string, unknown>
    >;
    expect(events.at(-1)).toMatchObject({
      kind: 'planner.artifact_published',
      payload: { slug: 'roadmap', title: 'New', questId: null, version: 2 },
    });
  });
  it('filters by quest and rejects missing quests', async () => {
    database.db
      .insert(worlds)
      .values({ id: 'w', name: 'W', kind: 'factory', order: 1, icon: 'w' })
      .run();
    database.db
      .insert(quests)
      .values({
        id: 'q',
        worldId: 'w',
        title: 'Q',
        pitch: 'P',
        status: 'building',
        sinceYouLooked: '',
        lastNote: '',
      })
      .run();
    await post({ ...body('quest'), questId: 'q' });
    expect((await (await app.request('/api/artifacts?quest=q')).json()) as unknown[]).toHaveLength(
      1,
    );
    expect((await app.request('/api/artifacts?quest=missing')).status).toBe(404);
    expect((await post({ ...body('missing'), questId: 'missing' })).status).toBe(404);
  });
  it('filters artifacts by kind', async () => {
    database.db
      .insert(worlds)
      .values({ id: 'w', name: 'W', kind: 'factory', order: 1, icon: 'w' })
      .run();
    database.db
      .insert(quests)
      .values({
        id: 'q',
        worldId: 'w',
        title: 'Q',
        pitch: 'P',
        status: 'building',
        sinceYouLooked: '',
        lastNote: '',
      })
      .run();
    await post({ ...body('quest-explainer'), questId: 'q' });
    await post(body('roadmap'));
    await post(body('a-concept'));
    expect(await (await app.request('/api/artifacts?kind=concept')).json()).toEqual([
      expect.objectContaining({ slug: 'a-concept' }),
    ]);
    expect(await (await app.request('/api/artifacts?kind=quest&quest=q')).json()).toEqual([
      expect.objectContaining({ slug: 'quest-explainer' }),
    ]);
    expect((await app.request('/api/artifacts?kind=nonsense')).status).toBe(400);
  });
  it('derives kind on publish and accepts an explicit kind', async () => {
    expect(await (await post(body('roadmap'))).json()).toMatchObject({ kind: 'roadmap' });
    expect(await (await post(body('derived-concept'))).json()).toMatchObject({ kind: 'concept' });
    expect(await (await post({ ...body('explicit'), kind: 'quest' })).json()).toMatchObject({
      kind: 'quest',
    });
  });
  it('serves verbatim HTML with confinement headers and redirects', async () => {
    expect((await app.request('/api/artifacts/does-not-exist')).status).toBe(404);
    expect((await app.request('/api/artifacts/does-not-exist', { method: 'DELETE' })).status).toBe(
      404,
    );
    await post(body());
    expect((await app.request('/artifacts/roadmap')).status).toBe(301);
    const response = await app.request('/artifacts/roadmap/');
    expect(await response.text()).toBe(html);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('content-security-policy')).toContain("frame-src 'self'");
    expect(response.headers.has('x-frame-options')).toBe(false);
    expect((await app.request('/api/artifacts/roadmap', { method: 'DELETE' })).status).toBe(204);
    expect((await app.request('/artifacts/roadmap/')).status).toBe(404);
  });
  it('rejects invalid HTML', async () => {
    expect((await post({ ...body(), html: '<html><img src="https://x.test">' })).status).toBe(400);
    expect((await post({ ...body(), html: `<html>${'x'.repeat(512 * 1024)}</html>` })).status).toBe(
      400,
    );
  });
  it('rejects an explainer with a disallowed embed', async () => {
    const response = await post({
      ...body(),
      html: '<html><iframe data-wyld-demo src="https://example.com/x"></iframe></html>',
    });
    expect(response.status).toBe(400);
    expect(await (await app.request('/api/artifacts')).json()).toEqual([]);
  });
  it('stores an explainer with debug=1 forced into the embed', async () => {
    const response = await post({
      ...body(),
      html: '<html><iframe data-wyld-demo src="/play/fw-2d/?scenario=creatures"></iframe></html>',
    });
    expect(response.status).toBe(201);
    expect(await (await app.request('/api/artifacts/roadmap')).json()).toMatchObject({
      html: expect.stringContaining(
        'data-wyld-demo="landscape" src="/play/fw-2d/?scenario=creatures&debug=1"',
      ),
    });
  });
});
