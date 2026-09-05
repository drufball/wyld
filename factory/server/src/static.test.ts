import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createStaticHandler } from './static.js';

describe('createStaticHandler', () => {
  let directory: string;
  let app: Hono;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wyld-static-'));
    fs.mkdirSync(path.join(directory, 'assets'));
    fs.writeFileSync(path.join(directory, 'index.html'), '<main>Pak</main>');
    fs.writeFileSync(path.join(directory, 'assets/app.js'), 'export const pak = true;');
    app = new Hono();
    app.all('*', createStaticHandler(directory));
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it.each(['/', '/some/deep/route', '/missing.js'])('serves the SPA for %s', async (url) => {
    const response = await app.request(url);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<main>Pak</main>');
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  it('serves assets with their content type and immutable caching', async () => {
    const response = await app.request('/assets/app.js');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('javascript');
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('supports HEAD without sending the file body', async () => {
    const response = await app.request('/assets/app.js', { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });

  it('rejects encoded path traversal', async () => {
    const response = await app.request('/%2e%2e%2fsecrets');
    expect(response.status).toBe(403);
  });

  it('does not serve the SPA for API or non-read requests', async () => {
    expect((await app.request('/api/nope')).status).toBe(404);
    expect((await app.request('/', { method: 'POST' })).status).toBe(404);
  });

  it('discovers a build created after startup and explains when it is missing', async () => {
    const missing = path.join(directory, 'later');
    const dynamicApp = new Hono();
    dynamicApp.all('*', createStaticHandler(missing));
    const absent = await dynamicApp.request('/');
    expect(absent.status).toBe(404);
    expect(await absent.json()).toEqual({
      error: 'Pak build not found',
      hint: 'pnpm --filter @wyld/pak build',
    });

    fs.mkdirSync(missing);
    fs.writeFileSync(path.join(missing, 'index.html'), 'ready');
    expect(await (await dynamicApp.request('/')).text()).toBe('ready');
  });
});
