import { z } from 'zod';

const Input = z.object({ kind: z.string().optional(), summary: z.string().min(1) });
const raw = process.argv[2];
if (raw === undefined) throw new Error("Usage: pnpm dev:emit '<summary or JSON>'");

let input: z.infer<typeof Input>;
try {
  input = Input.parse(JSON.parse(raw));
} catch {
  input = { summary: raw };
}

const port = process.env.WAKE_PORT ?? '8788';
const wakeSecret = process.env.WAKE_SECRET ?? '';
const baseUrl = `http://127.0.0.1:${port}`;
const response = await fetch(`${baseUrl}/event`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'X-Wake-Secret': wakeSecret },
  body: JSON.stringify({
    id: Date.now(),
    ts: new Date().toISOString(),
    source: 'human',
    kind: 'human.intent',
    payload: { summary: input.summary, requestedKind: input.kind },
  }),
});
if (!response.ok)
  throw new Error(`/event returned HTTP ${response.status}: ${await response.text()}`);
const healthResponse = await fetch(`${baseUrl}/health`);
if (!healthResponse.ok) throw new Error(`/health returned HTTP ${healthResponse.status}`);
const health = z.object({ queueDepth: z.number() }).parse(await healthResponse.json());
process.stdout.write(`Wake queue depth: ${health.queueDepth}\n`);
