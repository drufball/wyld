import fs from 'node:fs';
import path from 'node:path';

import type { Handler } from 'hono';

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const missingBuild = {
  error: 'Pak build not found',
  hint: 'pnpm --filter @wyld/pak build',
};

export function createStaticHandler(pakDist: string): Handler {
  const root = path.resolve(pakDist);

  return (c) => {
    if ((c.req.method !== 'GET' && c.req.method !== 'HEAD') || c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const response = resolveStaticFile(root, c.req.path, c.req.method);
    if (response === undefined) return c.json(missingBuild, 404);
    return response;
  };
}

export function resolveStaticFile(
  rootDirectory: string,
  rawPathname: string,
  method: string,
): Response | undefined {
  const root = path.resolve(rootDirectory);
  const indexPath = path.join(root, 'index.html');
  if (!fs.existsSync(root) || !fs.existsSync(indexPath)) return undefined;
  let pathname: string;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return Response.json({ error: 'Invalid path' }, { status: 400 });
  }
  const requestedPath = path.resolve(
    root,
    `.${pathname.startsWith('/') ? pathname : `/${pathname}`}`,
  );
  const relative = path.relative(root, requestedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const isFile = fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile();
  const filePath = isFile ? requestedPath : indexPath;
  const extension = path.extname(filePath).toLowerCase();
  const headers: Record<string, string> = {
    'content-type': contentTypes[extension] ?? 'application/octet-stream',
  };
  if (filePath === indexPath) headers['cache-control'] = 'no-cache';
  else if (pathname.startsWith('/assets/'))
    headers['cache-control'] = 'public, max-age=31536000, immutable';

  const body = method === 'HEAD' ? null : fs.readFileSync(filePath);
  return new Response(body, { status: 200, headers });
}
