import { HealthReport } from '@wyld/shared';
import { describe, expect, it, vi } from 'vitest';

import { createHeartbeat, type HeartbeatState } from './heartbeat.js';

const success = () => new Response(null, { status: 204 });

function setup(
  overrides: {
    intervalSeconds?: number;
    state?: HeartbeatState;
    fetch?: typeof fetch;
  } = {},
) {
  const timers: Array<{ callback: () => void; delay: number }> = [];
  const clearTimeout = vi.fn();
  const fetch = overrides.fetch ?? vi.fn(async () => success());
  const log = vi.fn();
  const heartbeat = createHeartbeat({
    pakUrl: 'http://pak.example/base/',
    intervalSeconds: overrides.intervalSeconds ?? 30,
    state: () => overrides.state ?? { turnInFlight: true, lastTurnAt: null },
    log,
    fetch,
    setTimeout: ((callback: () => void, delay: number) => {
      timers.push({ callback, delay });
      return timers.length;
    }) as never,
    clearTimeout: clearTimeout as never,
  });
  return { heartbeat, fetch, log, timers, clearTimeout };
}

function postedBody(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
}

describe('planner host heartbeat', () => {
  it('posts working state with exactly the liveness fields', async () => {
    const { heartbeat, fetch } = setup();
    await heartbeat.beat();

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe('http://pak.example/api/health/report');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const body = postedBody(fetch as ReturnType<typeof vi.fn>);
    expect(body).toEqual({ plannerState: 'working', currentTask: 'Handling events' });
    expect(Object.keys(body)).toEqual(['plannerState', 'currentTask']);
    expect(HealthReport.safeParse(body).success).toBe(true);
  });

  it('describes an idle host before its first turn', async () => {
    const { heartbeat, fetch } = setup({
      state: { turnInFlight: false, lastTurnAt: null },
    });
    await heartbeat.beat();
    expect(postedBody(fetch as ReturnType<typeof vi.fn>)).toEqual({
      plannerState: 'idle',
      currentTask: 'Waiting for events — no turn yet',
    });
  });

  it('includes the local time of the last completed turn while idle', async () => {
    const lastTurnAt = '2026-09-06T12:34:00.000Z';
    const expected = new Date(lastTurnAt).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const { heartbeat, fetch } = setup({
      state: { turnInFlight: false, lastTurnAt },
    });
    await heartbeat.beat();
    expect(postedBody(fetch as ReturnType<typeof vi.fn>)).toEqual({
      plannerState: 'idle',
      currentTask: `Waiting for events — last turn ${expected}`,
    });
  });

  it('starts immediately, reschedules, and is idempotent', async () => {
    const { heartbeat, fetch, timers } = setup();
    heartbeat.start();
    heartbeat.start();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(timers).toEqual([{ callback: expect.any(Function), delay: 30_000 }]),
    );

    timers[0]!.callback();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(timers[1]?.delay).toBe(30_000));
  });

  it('is disabled at a zero interval', async () => {
    const { heartbeat, fetch, log, timers } = setup({ intervalSeconds: 0 });
    heartbeat.start();
    heartbeat.start();
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
    expect(timers).toEqual([]);
    expect(log).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith('info', 'planner heartbeat disabled');
  });

  it.each([
    ['a rejected request', vi.fn(async () => Promise.reject(new Error('offline'))), undefined],
    ['a 500 response', vi.fn(async () => new Response(null, { status: 500 })), 500],
  ])('logs %s and schedules the next beat', async (_name, fetch, status) => {
    const { heartbeat, log, timers } = setup({ fetch: fetch as typeof globalThis.fetch });
    heartbeat.start();
    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith('warn', 'planner heartbeat failed', {
        ...(status === undefined ? {} : { status }),
        error: expect.any(String),
      }),
    );
    await vi.waitFor(() => expect(timers[0]?.delay).toBe(30_000));
  });

  it('stops a pending repeat and prevents further beats', async () => {
    const { heartbeat, fetch, timers, clearTimeout } = setup();
    heartbeat.start();
    await vi.waitFor(() => expect(timers).toHaveLength(1));
    heartbeat.stop();
    expect(clearTimeout).toHaveBeenCalledWith(1);
    timers[0]!.callback();
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledOnce();
  });
});
