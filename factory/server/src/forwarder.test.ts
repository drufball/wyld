import { describe, expect, it, vi } from 'vitest';
import { Event } from '@wyld/shared';
import { createWakeForwarder } from './forwarder.js';

describe('createWakeForwarder sleep events', () => {
  it('forwards alarms but not phase progress', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const forward = createWakeForwarder({
      wakeUrl: 'http://wake.test',
      wakeSecret: 'secret',
      fetch: fetcher,
    });
    const base = { id: 1, ts: '2026-09-06T23:00:00.000Z', source: 'sleep' as const, payload: {} };
    forward(Event.parse({ ...base, kind: 'sleep.alarm' }));
    forward(Event.parse({ ...base, id: 2, kind: 'sleep.phase' }));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toMatchObject({
      kind: 'sleep.alarm',
    });
  });
});
