import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startHealthServer } from './health.js';

describe('health server', () => {
  const servers: ReturnType<typeof startHealthServer>[] = [];
  afterEach(() => servers.splice(0).forEach((server) => server.close()));
  it('serves state only at GET /health', async () => {
    const server = startHealthServer(
      0,
      () => ({
        sessionId: null,
        lastTurnAt: null,
        queueDepthSeen: 2,
        restarts: 1,
      }),
      vi.fn(),
    );
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

  it('logs a fatal error and exits when the port is unavailable', async () => {
    const occupied = http.createServer().listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => occupied.once('listening', resolve));
    const address = occupied.address();
    if (address === null || typeof address === 'string') throw new Error('missing address');
    const log = vi.fn();
    const exit = vi.fn();
    const server = startHealthServer(
      address.port,
      () => ({ sessionId: null, lastTurnAt: null, queueDepthSeen: 0, restarts: 0 }),
      log,
      exit,
    );
    servers.push(server);
    await new Promise<void>((resolve) => server.once('error', () => resolve()));
    expect(log).toHaveBeenCalledWith('fatal', 'planner health server failed to listen', {
      port: address.port,
      error: expect.stringContaining('EADDRINUSE'),
    });
    expect(exit).toHaveBeenCalledWith(1);
    occupied.close();
  });
});
