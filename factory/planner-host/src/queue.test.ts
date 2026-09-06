import { describe, expect, it, vi } from 'vitest';
import { createQueueClient } from './queue.js';

const good = {
  id: 1,
  source: 'human',
  kind: 'human.ask',
  summary: 'hi',
  ts: '2026-09-05T00:00:00Z',
};
describe('queue client', () => {
  it('claims valid rows, drops recoverable invalid rows, and authenticates', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(
          JSON.stringify({ messages: [good, { ...good, id: 2, summary: '' }, { nope: true }] }),
          { status: 200 },
        ),
    );
    const log = vi.fn();
    const client = createQueueClient({ wakeUrl: 'http://wake', wakeSecret: 'secret', fetch, log });
    await expect(client.claim(20)).resolves.toEqual({ messages: [good], dropped: [2] });
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ 'X-Wake-Secret': 'secret' });
    expect(log.mock.calls.map((call) => call[0])).toEqual(['warn', 'error']);
  });
  it('does not request an empty ack', async () => {
    const fetch = vi.fn();
    await createQueueClient({ wakeUrl: '', wakeSecret: '', fetch, log: vi.fn() }).ack([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('logs only the first 401 and throws status and body', async () => {
    const fetch = vi.fn(async () => new Response('nope', { status: 401 }));
    const log = vi.fn();
    const client = createQueueClient({ wakeUrl: '', wakeSecret: '', fetch, log });
    await expect(client.claim(20)).rejects.toThrow('/queue/claim returned HTTP 401: nope');
    await expect(client.claim(20)).rejects.toThrow();
    expect(log).toHaveBeenCalledTimes(1);
  });
});
