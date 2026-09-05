import { z } from 'zod';

import { buildDevRequest, DevEventInput } from './dev-event.js';

const raw = process.argv[2];
if (raw === undefined) throw new Error("Usage: pnpm dev:emit '<summary or JSON>'");

let input: z.infer<typeof DevEventInput>;
try {
  input = DevEventInput.parse(JSON.parse(raw));
} catch {
  input = { summary: raw };
}

const port = process.env.WAKE_PORT ?? '8788';
const wakeSecret = process.env.WAKE_SECRET;
if (!wakeSecret) throw new Error('WAKE_SECRET is required to emit a Wake event');
const baseUrl = `http://127.0.0.1:${port}`;
const request = buildDevRequest(input, {
  wakeSecret,
  githubWebhookSecret: process.env.GH_WEBHOOK_SECRET,
});
const response = await fetch(`${baseUrl}${request.path}`, {
  method: 'POST',
  headers: request.headers,
  body: request.body,
});
if (!response.ok)
  throw new Error(`${request.path} returned HTTP ${response.status}: ${await response.text()}`);
const healthResponse = await fetch(`${baseUrl}/health`);
if (!healthResponse.ok) throw new Error(`/health returned HTTP ${healthResponse.status}`);
const health = z.object({ queueDepth: z.number() }).parse(await healthResponse.json());
process.stdout.write(`Wake queue depth: ${health.queueDepth}\n`);
