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
    tools?: Array<{
      name: string;
      description: string;
      inputSchema: { additionalProperties?: boolean };
    }>;
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

  it('lists all Planner tools with descriptions and closed schemas', async () => {
    const [list] = handlers(vi.fn());
    const result = await list!({});
    expect(result.tools?.map(({ name }) => name)).toEqual([
      'pak_log_event',
      'pak_set_next_action',
      'pak_upsert_quest',
      'pak_set_quest_status',
      'pak_set_since_you_looked',
      'pak_link_issue',
      'pak_read_quest_links',
      'pak_post_note',
      'pak_read_quests',
      'pak_read_events',
    ]);
    expect(result.tools?.every(({ description }) => description.length > 10)).toBe(true);
    expect(
      result.tools?.every(({ inputSchema }) => inputSchema.additionalProperties === false),
    ).toBe(true);
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

  it.each([
    [
      'pak_upsert_quest',
      {
        id: 'q1',
        world: 'factory',
        title: 'Tools',
        pitch: 'Drive API',
        status: 'building',
        since_you_looked: 'New',
        last_note: 'Note',
      },
      {},
      'http://pak/api/quests',
      'POST',
      {
        id: 'q1',
        worldId: 'factory',
        title: 'Tools',
        pitch: 'Drive API',
        status: 'building',
        sinceYouLooked: 'New',
        lastNote: 'Note',
      },
      { 'content-type': 'application/json' },
    ],
    [
      'pak_set_quest_status',
      { quest: 'q1', status: 'done' },
      {},
      'http://pak/api/quests/q1',
      'PATCH',
      { status: 'done', source: 'planner' },
      { 'content-type': 'application/json' },
    ],
    [
      'pak_set_since_you_looked',
      { quest: 'q1', text: 'Fresh' },
      {},
      'http://pak/api/quests/q1',
      'PATCH',
      { sinceYouLooked: 'Fresh', source: 'planner' },
      { 'content-type': 'application/json' },
    ],
    [
      'pak_link_issue',
      { quest: 'q1', gh_kind: 'pr', gh_ref: '24', state: 'open' },
      {},
      'http://pak/api/quests/q1/links',
      'POST',
      { ghKind: 'pr', ghRef: '24', state: 'open' },
      { 'content-type': 'application/json' },
    ],
    [
      'pak_read_quest_links',
      { quest: 'q1' },
      {},
      'http://pak/api/quests/q1/links',
      'GET',
      undefined,
      { 'X-Planner': '1' },
    ],
    [
      'pak_post_note',
      { quest: 'q1', text: 'Done' },
      {},
      'http://pak/api/quests/q1/notes',
      'POST',
      { text: 'Done', author: 'planner' },
      { 'content-type': 'application/json' },
    ],
    [
      'pak_read_quests',
      { world: 'factory', status: 'building' },
      { status: 'invalid' },
      'http://pak/api/quests?world=factory&status=building',
      'GET',
      undefined,
      {},
    ],
  ] as const)(
    'calls the API for %s and rejects invalid arguments',
    async (name, args, invalidArgs, url, method, body, headers) => {
      const fetch = vi.fn<typeof globalThis.fetch>();
      fetch.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
      const [, call] = handlers(fetch as typeof globalThis.fetch);
      expect((await call!({ params: { name, arguments: args } })).isError).toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(url, {
        method,
        headers,
        ...(body === undefined ? {} : { body: expect.any(String) }),
      });
      if (body !== undefined) {
        const request = fetch.mock.calls[0]![1] as RequestInit;
        expect(JSON.parse(String(request.body))).toEqual(body);
      }
      expect(await call!({ params: { name, arguments: invalidArgs } })).toMatchObject({
        isError: true,
      });
    },
  );

  it('reads events, filters kinds client-side, and applies the limit', async () => {
    const events = [
      { kind: 'human.ask', id: 1 },
      { kind: 'planner.note', id: 2 },
      { kind: 'human.ask', id: 3 },
    ];
    const fetch = vi.fn(async () => new Response(JSON.stringify(events), { status: 200 }));
    const [, call] = handlers(fetch as typeof globalThis.fetch);
    const result = await call!({
      params: { name: 'pak_read_events', arguments: { since: 4, kinds: ['human.ask'], limit: 1 } },
    });
    expect(fetch).toHaveBeenCalledWith('http://pak/api/events?since=4&limit=500', {
      method: 'GET',
      headers: {},
    });
    expect(JSON.parse(result.content![0]!.text)).toEqual([{ kind: 'human.ask', id: 3 }]);
    expect(
      await call!({ params: { name: 'pak_read_events', arguments: { kinds: ['invalid'] } } }),
    ).toMatchObject({ isError: true });
  });

  it('does not let the Planner author human notes', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 200 }));
    const [, call] = handlers(fetch as typeof globalThis.fetch);
    expect(
      await call!({
        params: {
          name: 'pak_post_note',
          arguments: { quest: 'q1', text: 'Not from Dru', author: 'human' },
        },
      }),
    ).toMatchObject({ isError: true });
    expect(fetch).not.toHaveBeenCalled();
  });
});
