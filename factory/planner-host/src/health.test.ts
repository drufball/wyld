import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { startHealthServer } from './health.js';

describe('health server', () => {
  const servers: ReturnType<typeof startHealthServer>[] = [];
  afterEach(() => servers.splice(0).forEach((server) => server.close()));
  it('serves state only at GET /health', async () => {
    const server = startHealthServer(0, () => ({
      sessionId: null,
      lastTurnAt: null,
      queueDepthSeen: 2,
      restarts: 1,
    }));
    servers.push(server);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('missing address');
    const get = (path: string) =>
      new Promise<{ status: number; body: string }>((resolve) =>
        http.get({ host: '127.0.0.1', port: address.port, path }, (response) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            body += chunk;
          });
          response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
        }),
      );
    const health = await get('/health');
    expect(health.status).toBe(200);
    expect(JSON.parse(health.body)).toEqual({
      ok: true,
      sessionId: null,
      lastTurnAt: null,
      queueDepthSeen: 2,
      restarts: 1,
    });
    expect((await get('/nope')).status).toBe(404);
  });
});
