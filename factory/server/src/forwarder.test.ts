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

describe('createWakeForwarder Pak events', () => {
  it('does not forward artifact publication', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const forward = createWakeForwarder({ wakeUrl: 'http://wake.test', fetch: fetcher });
    forward(
      Event.parse({
        id: 1,
        ts: '2026-09-07T06:30:00.000Z',
        source: 'planner',
        kind: 'planner.artifact_published',
        payload: { slug: 'roadmap' },
      }),
    );
    await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not forward achievement unlocks', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const forward = createWakeForwarder({ wakeUrl: 'http://wake.test', fetch: fetcher });
    forward(
      Event.parse({
        id: 1,
        ts: '2026-09-06T06:30:00.000Z',
        source: 'pak',
        kind: 'pak.achievement_unlocked',
        payload: { id: 'early-bird', name: 'Early Bird', badge: '🐦' },
      }),
    );
    await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
