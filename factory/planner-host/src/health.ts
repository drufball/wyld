import http, { type Server } from 'node:http';
import type { Logger } from './logger.js';

export type HealthState = {
  sessionId: string | null;
  lastTurnAt: string | null;
  queueDepthSeen: number;
  restarts: number;
};

export function startHealthServer(
  port: number,
  state: () => HealthState,
  log: Logger,
  exit: (code: number) => void = process.exit,
): Server {
  const server = http.createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, ...state() }));
  });
  server.on('error', (error) => {
    log('fatal', 'planner health server failed to listen', { port, error: String(error) });
    exit(1);
  });
  return server.listen(port, '127.0.0.1');
}
