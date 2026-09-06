import http, { type Server } from 'node:http';

export type HealthState = {
  sessionId: string | null;
  lastTurnAt: string | null;
  queueDepthSeen: number;
  restarts: number;
};

export function startHealthServer(port: number, state: () => HealthState): Server {
  return http
    .createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== '/health') {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, ...state() }));
    })
    .listen(port, '127.0.0.1');
}
