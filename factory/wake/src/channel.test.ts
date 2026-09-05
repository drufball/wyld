import { PassThrough } from 'node:stream';

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { describe, expect, it, vi } from 'vitest';

import {
  createDaemonPost,
  createDeliveryLoop,
  createStreamLogger,
  notificationFor,
  registerPakTools,
  type QueuedMessage,
} from './channel.js';

const later: QueuedMessage = {
  id: 2,
  source: 'github',
  kind: 'github.pr_opened',
  summary: 'later',
  ts: '2026-09-05T10:00:01.000Z',
  quest: 'wake',
  issue: 17,
  pr: 99,
  url: 'https://example.com/pr/99',
};
const earlier: QueuedMessage = {
  id: 1,
  source: 'human',
  kind: 'human.intent',
  summary: 'earlier',
  ts: '2026-09-05T10:00:00.000Z',
};

describe('Wake channel delivery', () => {
  it('logs missing credentials and only the first unauthorized response at error', async () => {
    const log = vi.fn();
    const daemonPost = createDaemonPost({
      wakeUrl: 'http://wake',
      wakeSecret: '',
      fetch: vi.fn(async () => new Response('Unauthorized', { status: 401 })) as typeof fetch,
      log,
    });
    expect(log).toHaveBeenCalledWith('error', expect.stringContaining('WAKE_SECRET'));
    await expect(daemonPost('/queue/claim', {})).rejects.toThrow('HTTP 401');
    await expect(daemonPost('/queue/claim', {})).rejects.toThrow('HTTP 401');
    expect(log.mock.calls.filter(([level]) => level === 'error')).toHaveLength(2);
    expect(log).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('rejected channel authentication'),
      { path: '/queue/claim', status: 401 },
    );
  });

  it('replays startup backlog in timestamp order, then acknowledges it', async () => {
    const emitted: string[] = [];
    const emit = vi.fn(async (message: ReturnType<typeof notificationFor>) => {
      emitted.push(message.params.content);
    });
    const ack = vi.fn(async () => undefined);
    const loop = createDeliveryLoop({
      claim: async () => [later, earlier],
      ack,
      emit,
      log: vi.fn(),
    });
    await loop.tick();
    expect(emitted).toEqual(['earlier', 'later']);
    expect(ack).toHaveBeenCalledWith([1, 2]);

    const notification = notificationFor(later);
    expect(notification.params.meta).toEqual({
      kind: 'github.pr_opened',
      ts: later.ts,
      source: 'github',
      quest: 'wake',
      issue: '17',
      pr: '99',
      url: 'https://example.com/pr/99',
    });
    expect(Object.keys(notification.params.meta).every((key) => /^[A-Za-z0-9_]+$/.test(key))).toBe(
      true,
    );
    expect(
      Object.values(notification.params.meta).every((value) => typeof value === 'string'),
    ).toBe(true);
    expect(notificationFor(earlier).params.meta).not.toHaveProperty('quest');
  });

  it('re-emits messages after an acknowledgement failure', async () => {
    const emit = vi.fn(async () => undefined);
    const ack = vi.fn().mockRejectedValueOnce(new Error('ack down')).mockResolvedValue(undefined);
    const loop = createDeliveryLoop({ claim: async () => [earlier], ack, emit, log: vi.fn() });
    await loop.tick();
    await loop.tick();
    expect(emit).toHaveBeenCalledTimes(2);
    expect(ack).toHaveBeenCalledTimes(2);
  });

  it('logs daemon failures without rejecting and can retry', async () => {
    const log = vi.fn();
    const claim = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
    const loop = createDeliveryLoop({ claim, ack: vi.fn(), emit: vi.fn(), log });
    await expect(loop.tick()).resolves.toBeUndefined();
    await expect(loop.tick()).resolves.toBeUndefined();
    expect(claim).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(
      'debug',
      expect.any(String),
      expect.objectContaining({ retryMs: 2000 }),
    );
  });

  it('uses the adapter-provided stderr stream rather than stdout', () => {
    const stderr = new PassThrough();
    let output = '';
    stderr.on('data', (chunk) => (output += String(chunk)));
    createStreamLogger(stderr)('debug', 'retry');
    expect(output).toContain('"msg":"retry"');
  });
});

describe('Pak tools', () => {
  type CapturedHandler = (request: {
    params?: { name: string; arguments?: Record<string, unknown> };
  }) => Promise<{
    tools?: Array<{ name: string; description: string }>;
    content?: Array<{ text: string }>;
    isError?: boolean;
  }>;

  function handlers(fetch: typeof globalThis.fetch) {
    const registered: CapturedHandler[] = [];
    registerPakTools(
      {
        setRequestHandler: (_schema: unknown, handler: unknown) =>
          registered.push(handler as CapturedHandler),
      } as unknown as Server,
      { pakUrl: 'http://pak', fetch },
    );
    return registered;
  }

  it('lists exactly the two Planner tools with descriptions', async () => {
    const [list] = handlers(vi.fn());
    const result = await list!({});
    expect(result.tools?.map(({ name }) => name)).toEqual(['pak_log_event', 'pak_set_next_action']);
    expect(result.tools?.every(({ description }) => description.length > 10)).toBe(true);
  });

  it('posts a valid event and rejects an invalid kind', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 200 }));
    const [, call] = handlers(fetch as typeof globalThis.fetch);
    const success = await call!({
      params: {
        name: 'pak_log_event',
        arguments: { kind: 'planner.note', summary: 'done', quest: 'q1' },
      },
    });
    expect(success.isError).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      'http://pak/api/events',
      expect.objectContaining({
        body: JSON.stringify({
          source: 'planner',
          kind: 'planner.note',
          payload: { summary: 'done' },
          questId: 'q1',
        }),
      }),
    );
    const invalid = await call!({
      params: { name: 'pak_log_event', arguments: { kind: 'nope', summary: 'bad' } },
    });
    expect(invalid).toMatchObject({ isError: true });
    expect(invalid.content?.[0]?.text).toContain('Valid kinds');
  });

  it('returns a non-fatal tool error when next-action is not implemented', async () => {
    const [, call] = handlers(
      vi.fn(async () => new Response('Not Found', { status: 404 })) as typeof globalThis.fetch,
    );
    const result = await call!({
      params: { name: 'pak_set_next_action', arguments: { text: 'Ship it' } },
    });
    expect(result).toMatchObject({ isError: true });
    expect(result.content?.[0]?.text).toContain('HTTP 404');
    expect(result.content?.[0]?.text).toContain('not implemented yet');
  });
});
