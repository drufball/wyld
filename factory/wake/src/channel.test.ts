import { PassThrough } from 'node:stream';

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { describe, expect, it, vi } from 'vitest';

import {
  createDaemonPost,
  createDeliveryLoop,
  createStreamLogger,
  notificationFor,
  parseClaimResponse,
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
  chain: 7,
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
      claim: async () => ({ messages: [later, earlier], dropped: [] }),
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
      chain: '7',
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
    const loop = createDeliveryLoop({
      claim: async () => ({ messages: [earlier], dropped: [] }),
      ack,
      emit,
      log: vi.fn(),
    });
    await loop.tick();
    await loop.tick();
    expect(emit).toHaveBeenCalledTimes(2);
    expect(ack).toHaveBeenCalledTimes(2);
  });

  it('logs daemon failures without rejecting and can retry', async () => {
    const log = vi.fn();
    const claim = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ messages: [], dropped: [] });
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

  it('delivers an event kind unknown to this build', async () => {
    const parsed = parseClaimResponse({
      messages: [{ ...earlier, kind: 'human.telepathy', summary: 'Read my mind' }],
    });
    const emit = vi.fn(async () => undefined);
    const loop = createDeliveryLoop({
      claim: async () => parsed,
      ack: vi.fn(async () => undefined),
      emit,
      log: vi.fn(),
    });
    await loop.tick();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          content: 'Read my mind',
          meta: expect.objectContaining({ kind: 'human.telepathy' }),
        }),
      }),
    );
  });

  it('drops malformed entries while delivering and acknowledging the rest', async () => {
    const log = vi.fn();
    const parsed = parseClaimResponse(
      { messages: [{ ...later, id: 3 }, { id: 2, source: 'human' }, earlier] },
      log,
    );
    const emitted: string[] = [];
    const ack = vi.fn(async () => undefined);
    const loop = createDeliveryLoop({
      claim: async () => parsed,
      ack,
      emit: async (notification) => void emitted.push(notification.params.content),
      log,
    });
    await loop.tick();
    expect(emitted).toEqual(['earlier', 'later']);
    expect(log).toHaveBeenCalledWith(
      'warn',
      expect.any(String),
      expect.objectContaining({ id: 2 }),
    );
    expect(ack).toHaveBeenCalledWith([1, 3, 2]);
  });

  it('logs malformed entries without usable ids and does not acknowledge them', async () => {
    const log = vi.fn();
    const parsed = parseClaimResponse({ messages: [{ source: 'human' }, earlier] }, log);
    const ack = vi.fn(async () => undefined);
    const loop = createDeliveryLoop({
      claim: async () => parsed,
      ack,
      emit: vi.fn(async () => undefined),
      log,
    });
    await loop.tick();
    expect(log).toHaveBeenCalledWith(
      'error',
      expect.any(String),
      expect.not.objectContaining({ id: expect.anything() }),
    );
    expect(ack).toHaveBeenCalledWith([1]);
  });

  it.each([{}, { messages: 'nope' }])('rejects a malformed claim envelope', (envelope) => {
    expect(() => parseClaimResponse(envelope)).toThrow();
  });

  it('acknowledges emitted and dropped ids when a later emission fails', async () => {
    const log = vi.fn();
    const ack = vi.fn(async () => undefined);
    const emit = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('closed'));
    const loop = createDeliveryLoop({
      claim: async () => ({ messages: [earlier, later], dropped: [3] }),
      ack,
      emit,
      log,
    });
    await loop.tick();
    expect(ack).toHaveBeenCalledWith([1, 3]);
    expect(log).toHaveBeenCalledWith(
      'debug',
      expect.any(String),
      expect.objectContaining({ error: 'closed', retryMs: 2000 }),
    );
  });
});

describe('Pak tools', () => {
  type CapturedHandler = (request: {
    params?: { name: string; arguments?: Record<string, unknown> };
  }) => Promise<{
    tools?: Array<{
      name: string;
      description: string;
      inputSchema: {
        properties?: Record<string, Record<string, unknown>>;
        required?: string[];
        additionalProperties?: boolean;
      };
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
      'pak_write_catchup',
      'pak_read_catchup',
      'pak_health_report',
      'pak_read_health',
      'pak_request_rumble',
      'pak_read_rumbles',
      'pak_register_demo',
      'pak_read_demos',
      'pak_read_feedback',
      'pak_read_chains',
      'pak_send_message',
      'pak_answer_chain',
      'pak_close_chain',
    ]);
    expect(result.tools?.every(({ description }) => description.length > 10)).toBe(true);
    expect(
      result.tools?.every(({ inputSchema }) => inputSchema.additionalProperties === false),
    ).toBe(true);
    expect(
      result.tools?.find(({ name }) => name === 'pak_register_demo')?.inputSchema,
    ).toMatchObject({
      properties: {
        slug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,63}$' },
        ref: { type: 'string' },
        quest: { type: 'string' },
        title: { type: 'string' },
      },
      required: ['slug', 'ref'],
      additionalProperties: false,
    });
    expect(result.tools?.find(({ name }) => name === 'pak_read_demos')?.inputSchema).toMatchObject({
      properties: {},
      additionalProperties: false,
    });
    expect(
      result.tools?.find(({ name }) => name === 'pak_read_feedback')?.inputSchema,
    ).toMatchObject({
      properties: { demo: { type: 'string' } },
      additionalProperties: false,
    });
  });

  it('posts event kinds without gating them against the adapter vocabulary', async () => {
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
    const future = await call!({
      params: { name: 'pak_log_event', arguments: { kind: 'nope', summary: 'bad' } },
    });
    expect(future.isError).toBeUndefined();
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
      JSON.parse(
        (await call!({ params: { name: 'pak_read_events', arguments: { kinds: ['invalid'] } } }))
          .content![0]!.text,
      ),
    ).toEqual([]);
  });

  it('writes a Catch-Up digest with camelCase deep links and omitted default range', async () => {
    const fetch = vi.fn(async () => new Response('{"id":1}', { status: 201 }));
    const [, call] = handlers(fetch as typeof globalThis.fetch);
    const result = await call!({
      params: {
        name: 'pak_write_catchup',
        arguments: {
          rumbles: [{ text: 'A choice is waiting', deep_link: '/quests/choice' }],
          demos: [{ text: 'Try the new controls' }],
          shipped: [{ text: 'Wake now reconnects' }],
          fyi: ['Nothing needs attention'],
        },
      },
    });

    expect(result.isError).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('http://pak/api/catchup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        digest: {
          rumbles: [{ text: 'A choice is waiting', deepLink: '/quests/choice' }],
          demos: [{ text: 'Try the new controls' }],
          shipped: [{ text: 'Wake now reconnects' }],
          fyi: ['Nothing needs attention'],
        },
      }),
    });
  });

  it('writes an explicit Catch-Up event range', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch.mockResolvedValue(new Response('', { status: 201 }));
    const [, call] = handlers(fetch);
    await call!({
      params: {
        name: 'pak_write_catchup',
        arguments: { from_event_id: 12, to_event_id: 34 },
      },
    });

    const request = fetch.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      digest: { rumbles: [], demos: [], shipped: [], fyi: [] },
      fromEventId: 12,
      toEventId: 34,
    });
  });

  it.each([{ unknown: true }, { fyi: [42] }])(
    'rejects invalid Catch-Up arguments without an HTTP call: %j',
    async (arguments_) => {
      const fetch = vi.fn<typeof globalThis.fetch>();
      const [, call] = handlers(fetch);
      const result = await call!({
        params: { name: 'pak_write_catchup', arguments: arguments_ },
      });

      expect(result).toMatchObject({ isError: true });
      expect(result.content?.[0]?.text).toContain('Invalid arguments');
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('reads the current Catch-Up response verbatim', async () => {
    const body = JSON.stringify({ show: true, unseenCount: 3, catchup: { id: 1 } });
    const fetch = vi.fn(async () => new Response(body, { status: 200 }));
    const [, call] = handlers(fetch as typeof globalThis.fetch);
    const result = await call!({ params: { name: 'pak_read_catchup', arguments: {} } });

    expect(fetch).toHaveBeenCalledWith('http://pak/api/catchup', { method: 'GET', headers: {} });
    expect(result.content?.[0]?.text).toBe(body);
    expect(result.isError).toBeUndefined();
  });

  it('posts a health report with camelCase fields and omits absent fields', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 200 }));
    const [, call] = handlers(fetch as typeof globalThis.fetch);
    const result = await call!({
      params: {
        name: 'pak_health_report',
        arguments: {
          planner_state: 'working',
          current_task: 'Implement health tools',
          gh_rate_remaining: 123,
          ci_state: 'pass',
          cost_today: 4.5,
          codex_prs_open: 2,
        },
      },
    });

    expect(result.isError).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('http://pak/api/health/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        plannerState: 'working',
        currentTask: 'Implement health tools',
        ghRateRemaining: 123,
        ciState: 'pass',
        costToday: 4.5,
        codexPrsOpen: 2,
      }),
    });
  });

  it('rejects an invalid Planner state without posting a health report', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const [, call] = handlers(fetch);

    expect(
      await call!({
        params: { name: 'pak_health_report', arguments: { planner_state: 'sleeping' } },
      }),
    ).toMatchObject({ isError: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads the current health snapshot', async () => {
    const body = JSON.stringify({ ts: '2026-09-05T10:00:00.000Z' });
    const fetch = vi.fn(async () => new Response(body, { status: 200 }));
    const [, call] = handlers(fetch as typeof globalThis.fetch);
    const result = await call!({ params: { name: 'pak_read_health', arguments: {} } });

    expect(fetch).toHaveBeenCalledWith('http://pak/api/health/snapshot', {
      method: 'GET',
      headers: {},
    });
    expect(result.content?.[0]?.text).toBe(body);
    expect(result.isError).toBeUndefined();
  });

  it.each([
    [
      'pak_read_chains',
      { quest: 'wake & queue' },
      'http://pak/api/chains?quest=wake+%26+queue',
      'GET',
      undefined,
    ],
    [
      'pak_send_message',
      { text: 'A proactive update', quest: 'wake' },
      'http://pak/api/chains',
      'POST',
      { text: 'A proactive update', author: 'planner', questId: 'wake' },
    ],
    [
      'pak_send_message',
      { text: 'An open update' },
      'http://pak/api/chains',
      'POST',
      { text: 'An open update', author: 'planner' },
    ],
    [
      'pak_answer_chain',
      { chain: 7, text: 'Wake delivers each question to me.' },
      'http://pak/api/chains/7/messages',
      'POST',
      { author: 'planner', text: 'Wake delivers each question to me.' },
    ],
    [
      'pak_close_chain',
      { chain: 7 },
      'http://pak/api/chains/7/close',
      'POST',
      { reason: 'settled', source: 'planner' },
    ],
  ] as const)('calls the chain API for %s', async (name, args, url, method, body) => {
    const fetch = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    const [, call] = handlers(fetch as typeof globalThis.fetch);

    expect((await call!({ params: { name, arguments: args } })).isError).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(url, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  });

  it.each([{}, { text: '' }])('rejects invalid pak_send_message arguments: %j', async (args) => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const [, call] = handlers(fetch);

    expect(await call!({ params: { name: 'pak_send_message', arguments: args } })).toMatchObject({
      isError: true,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requests a Rumble with mapped arguments and defaults', async () => {
    const fetch = vi.fn(async () => new Response('{"id":"rumble-1"}', { status: 200 }));
    const [, call] = handlers(fetch as typeof globalThis.fetch);

    const result = await call!({
      params: {
        name: 'pak_request_rumble',
        arguments: {
          title: 'Choose a model',
          context: 'The prototypes differ. Pick the direction we should pursue.',
          options: ['Fast', 'Beautiful'],
          kind: 'model',
        },
      },
    });

    expect(result.isError).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('http://pak/api/rumbles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Choose a model',
        context: 'The prototypes differ. Pick the direction we should pursue.',
        options: ['Fast', 'Beautiful'],
        kind: 'model',
        blockingQuestIds: [],
      }),
    });
  });

  it('maps blocking quests when requesting a Rumble', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response('{"id":"rumble-1"}', { status: 200 }),
    );
    const [, call] = handlers(fetch as typeof globalThis.fetch);

    await call!({
      params: {
        name: 'pak_request_rumble',
        arguments: {
          title: 'Choose the scope',
          context: 'Two quests depend on this. Pick the scope to unblock them.',
          options: ['Small', 'Large'],
          kind: 'scope',
          blocking_quests: ['quest-one', 'quest-two'],
        },
      },
    });

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      blockingQuestIds: ['quest-one', 'quest-two'],
    });
  });

  it.each([
    { options: [] },
    { options: ['one', 'two', 'three', 'four', 'five'] },
    { kind: 'weather' },
  ])('rejects invalid Rumble arguments: %o', async (override) => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const [, call] = handlers(fetch);
    const result = await call!({
      params: {
        name: 'pak_request_rumble',
        arguments: {
          title: 'Choose',
          context: 'A choice is required. Pick one.',
          options: ['one'],
          kind: 'scope',
          ...override,
        },
      },
    });

    expect(result).toMatchObject({ isError: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, 'http://pak/api/rumbles'],
    ['open', 'http://pak/api/rumbles?status=open'],
  ] as const)('reads Rumbles with status %s', async (status, url) => {
    const fetch = vi.fn(async () => new Response('[]', { status: 200 }));
    const [, call] = handlers(fetch as typeof globalThis.fetch);
    const result = await call!({
      params: {
        name: 'pak_read_rumbles',
        arguments: status === undefined ? {} : { status },
      },
    });

    expect(result.isError).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(url, { method: 'GET', headers: {} });
  });

  it('registers a Demo Disc with mapped arguments and omitted optionals', async () => {
    const fetch = vi.fn(async () => new Response('{"id":"demo-discs"}', { status: 200 }));
    const [, call] = handlers(fetch as typeof globalThis.fetch);

    const result = await call!({
      params: {
        name: 'pak_register_demo',
        arguments: {
          slug: 'demo-discs',
          ref: 'codex/wake-demo-tools',
          quest: 'demo-discs',
        },
      },
    });

    expect(result.isError).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('http://pak/api/demos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'demo-discs',
        ref: 'codex/wake-demo-tools',
        questId: 'demo-discs',
      }),
    });
  });

  it('registers a titled main Demo Disc without a quest', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response('{"id":"main"}', { status: 200 }),
    );
    const [, call] = handlers(fetch);

    await call!({
      params: {
        name: 'pak_register_demo',
        arguments: { slug: 'main', ref: 'main', title: 'Main build' },
      },
    });

    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      id: 'main',
      ref: 'main',
      title: 'Main build',
    });
  });

  it.each([
    { slug: 'Bad Slug', ref: 'main' },
    { slug: 'main', ref: 'main', unknown: true },
  ])('rejects invalid Demo Disc registration without an HTTP call: %j', async (arguments_) => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const [, call] = handlers(fetch);

    const result = await call!({ params: { name: 'pak_register_demo', arguments: arguments_ } });

    expect(result).toMatchObject({ isError: true });
    expect(result.content?.[0]?.text).toContain('Invalid arguments');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['pak_read_demos', {}, 'http://pak/api/demos'],
    ['pak_read_feedback', {}, 'http://pak/api/feedback'],
    ['pak_read_feedback', { demo: 'demo discs' }, 'http://pak/api/feedback?demo=demo+discs'],
  ] as const)('reads Demo Disc data with %s', async (name, arguments_, url) => {
    const fetch = vi.fn(async () => new Response('[]', { status: 200 }));
    const [, call] = handlers(fetch as typeof globalThis.fetch);

    const result = await call!({ params: { name, arguments: arguments_ } });

    expect(result.isError).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(url, { method: 'GET', headers: {} });
  });

  it.each(['pak_read_demos', 'pak_read_feedback'])(
    'rejects unknown properties for %s without an HTTP call',
    async (name) => {
      const fetch = vi.fn<typeof globalThis.fetch>();
      const [, call] = handlers(fetch);

      expect(await call!({ params: { name, arguments: { unknown: true } } })).toMatchObject({
        isError: true,
      });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each(['pak_read_chains', 'pak_answer_chain', 'pak_close_chain'])(
    'reports an HTTP failure for %s',
    async (name) => {
      const fetch = vi.fn(async () => new Response('unavailable', { status: 503 }));
      const [, call] = handlers(fetch as typeof globalThis.fetch);
      const arguments_ =
        name === 'pak_read_chains'
          ? {}
          : name === 'pak_answer_chain'
            ? { chain: 7, text: 'Answer' }
            : { chain: 7 };

      const result = await call!({ params: { name, arguments: arguments_ } });
      expect(result).toMatchObject({ isError: true });
      expect(result.content?.[0]?.text).toContain('HTTP 503');
    },
  );

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
