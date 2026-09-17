import type { Query, SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it, vi } from 'vitest';
import { readConfig } from './config.js';
import { DEFAULT_FIRST_MESSAGE, createHost } from './host.js';
import type { QueuedMessage } from './queue.js';

const row = (id: number): QueuedMessage => ({
  id,
  source: 'human',
  kind: `kind.${id}`,
  summary: `event ${id}`,
  ts: `2026-09-05T00:00:0${id}Z`,
});
const defer = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('planner host', () => {
  it('announces initialized sessions and exposes heartbeat turn state', async () => {
    const release = defer();
    const onSessionReady = vi.fn();
    let clock = Date.parse('2026-09-06T12:00:00.000Z');
    const host = createHost({
      config: readConfig({ WAKE_SECRET: 'x'.repeat(16) }),
      queue: { claim: vi.fn().mockResolvedValue({ messages: [], dropped: [] }), ack: vi.fn() },
      log: vi.fn(),
      query: (() =>
        (async function* () {
          yield {
            type: 'system',
            subtype: 'init',
            session_id: 'session',
            tools: [],
            mcp_servers: [{ name: 'wake', status: 'connected' }],
          } as unknown as SDKMessage;
          await release.promise;
          yield {
            type: 'result',
            subtype: 'success',
            is_error: false,
            num_turns: 1,
          } as unknown as SDKMessage;
          await new Promise(() => undefined);
        })() as Query) as never,
      readSession: () => null,
      writeSession: vi.fn(),
      adapterExists: () => true,
      now: () => clock,
      onSessionReady,
      setTimeout: vi.fn(() => 1) as never,
      clearTimeout: vi.fn() as never,
    });
    host.start();
    await vi.waitFor(() => expect(onSessionReady).toHaveBeenCalledOnce());
    expect(host.heartbeatState()).toEqual({
      turnInFlight: true,
      lastTurnAt: null,
      model: 'claude-fable-5-1',
      modelLimited: undefined,
    });
    clock += 60_000;
    release.resolve();
    await vi.waitFor(() =>
      expect(host.heartbeatState()).toEqual({
        turnInFlight: false,
        lastTurnAt: '2026-09-06T12:01:00.000Z',
        model: 'claude-fable-5-1',
        modelLimited: undefined,
      }),
    );
    host.stop();
  });

  it('bootstraps, batches claims, waits for result, and then acks', async () => {
    const firstResult = defer();
    const secondResult = defer();
    const prompts: SDKUserMessage[] = [];
    let run = 0;
    const query = (({ prompt }: { prompt: AsyncIterable<SDKUserMessage> }) =>
      (async function* () {
        run++;
        const iterator = prompt[Symbol.asyncIterator]();
        prompts.push((await iterator.next()).value!);
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'session',
          tools: [],
          mcp_servers: [{ name: 'wake', status: 'connected' }],
        } as unknown as SDKMessage;
        if (run === 1) {
          await firstResult.promise;
          yield {
            type: 'result',
            subtype: 'success',
            session_id: 'session',
            is_error: false,
            num_turns: 1,
            total_cost_usd: 0,
          } as unknown as SDKMessage;
          prompts.push((await iterator.next()).value!);
          await secondResult.promise;
          yield {
            type: 'result',
            subtype: 'success',
            session_id: 'session',
            is_error: false,
            num_turns: 1,
            total_cost_usd: 0,
          } as unknown as SDKMessage;
        }
      })() as Query) as never;
    const claim = vi
      .fn()
      .mockResolvedValueOnce({ messages: [row(3), row(1), row(2)], dropped: [] })
      .mockResolvedValue({ messages: [row(1)], dropped: [] });
    const ack = vi.fn(async () => undefined);
    const timers: Array<() => void> = [];
    const config = { ...readConfig({ WAKE_SECRET: 'x'.repeat(16) }), pollMs: 99_999 };
    const host = createHost({
      config,
      queue: { claim, ack },
      log: vi.fn(),
      query,
      readSession: () => null,
      writeSession: vi.fn(),
      adapterExists: () => true,
      setTimeout: ((callback: () => void) => {
        timers.push(callback);
        return 1;
      }) as never,
      clearTimeout: vi.fn() as never,
    });
    host.start();
    await vi.waitFor(() => expect(prompts).toHaveLength(1));
    expect(prompts[0]?.message.content).toBe(DEFAULT_FIRST_MESSAGE);
    firstResult.resolve();
    await vi.waitFor(() => expect(prompts).toHaveLength(2));
    expect((prompts[1]?.message.content as string).match(/<channel /g)).toHaveLength(3);
    expect(ack).toHaveBeenCalledWith([]);
    expect(ack).not.toHaveBeenCalledWith([3, 1, 2]);
    secondResult.resolve();
    await vi.waitFor(() => expect(ack).toHaveBeenCalledWith([3, 1, 2]));
    host.stop();
  });

  it('logs Claude stderr through the structured logger', () => {
    const log = vi.fn();
    let stderr: ((data: string) => void) | undefined;
    const host = createHost({
      config: readConfig({ WAKE_SECRET: 'x'.repeat(16) }),
      queue: { claim: vi.fn().mockResolvedValue({ messages: [], dropped: [] }), ack: vi.fn() },
      log,
      query: (({ options }: { options: { stderr?: (data: string) => void } }) => {
        stderr = options.stderr;
        return (async function* () {
          yield* [] as SDKMessage[];
          await new Promise(() => undefined);
        })() as Query;
      }) as never,
      readSession: () => 'session',
      adapterExists: () => true,
    });
    host.start();
    stderr?.(`  ${'x'.repeat(600)}  `);
    expect(log).toHaveBeenCalledWith('debug', 'claude stderr', { data: 'x'.repeat(500) });
    host.stop();
  });

  it('restarts a failed query with the same session and re-queues its in-flight batch', async () => {
    const prompts: string[] = [];
    const resumes: Array<string | undefined> = [];
    let run = 0;
    const query = (({
      prompt,
      options,
    }: {
      prompt: AsyncIterable<SDKUserMessage>;
      options: { resume?: string };
    }) => {
      resumes.push(options.resume);
      return (async function* () {
        yield* [] as SDKMessage[];
        const message = await prompt[Symbol.asyncIterator]().next();
        prompts.push(message.value!.message.content as string);
        if (++run === 1) throw new Error('boom');
        await new Promise(() => undefined);
      })() as Query;
    }) as never;
    const timers: Array<{ callback: () => void; delay: number }> = [];
    const host = createHost({
      config: { ...readConfig({ WAKE_SECRET: 'x'.repeat(16) }), pollMs: 99_999 },
      queue: {
        claim: vi
          .fn()
          .mockResolvedValueOnce({ messages: [row(4)], dropped: [] })
          .mockResolvedValue({ messages: [], dropped: [] }),
        ack: vi.fn(async () => undefined),
      },
      log: vi.fn(),
      query,
      readSession: () => 'saved-session',
      adapterExists: () => true,
      setTimeout: ((callback: () => void, delay: number) => {
        timers.push({ callback, delay });
        return 1;
      }) as never,
      clearTimeout: vi.fn() as never,
    });
    host.start();
    await vi.waitFor(() => expect(timers.some((timer) => timer.delay === 1_000)).toBe(true));
    timers.find((timer) => timer.delay === 1_000)!.callback();
    await vi.waitFor(() => expect(prompts).toHaveLength(2));
    expect(resumes).toEqual(['saved-session', 'saved-session']);
    expect(prompts[1]).toBe(prompts[0]);
    host.stop();
  });

  it('only watchdog-restarts an idle query when events are pending', async () => {
    let clock = 0;
    const timers: Array<{ callback: () => void; delay: number }> = [];
    const claim = vi.fn().mockResolvedValue({ messages: [], dropped: [] });
    const host = createHost({
      config: { ...readConfig({ WAKE_SECRET: 'x'.repeat(16) }), pollMs: 100, idleTimeoutMs: 50 },
      queue: { claim, ack: vi.fn(async () => undefined) },
      log: vi.fn(),
      query: (() =>
        (async function* () {
          yield* [] as SDKMessage[];
          await new Promise(() => undefined);
        })() as Query) as never,
      readSession: () => 'session',
      adapterExists: () => true,
      now: () => clock,
      setTimeout: ((callback: () => void, delay: number) => {
        timers.push({ callback, delay });
        return 1;
      }) as never,
      clearTimeout: vi.fn() as never,
    });
    host.start();
    clock = 100;
    timers.find((timer) => timer.delay === 50)!.callback();
    expect(host.health().restarts).toBe(0);
    claim.mockResolvedValueOnce({ messages: [row(5)], dropped: [] });
    await host.tick();
    const watchdogs = timers.filter((timer) => timer.delay === 50);
    watchdogs.at(-1)!.callback();
    expect(host.health().restarts).toBe(1);
    host.stop();
  });

  it('starts fresh when a resumed query returns a result before init', async () => {
    const writes: Array<string | null> = [];
    const prompts: string[] = [];
    let run = 0;
    const query = (({ prompt }: { prompt: AsyncIterable<SDKUserMessage> }) =>
      (async function* () {
        if (++run === 1) {
          yield {
            type: 'result',
            subtype: 'error_during_execution',
            is_error: true,
            num_turns: 0,
          } as unknown as SDKMessage;
          return;
        }
        prompts.push(
          (await prompt[Symbol.asyncIterator]().next()).value!.message.content as string,
        );
        await new Promise(() => undefined);
      })() as Query) as never;
    const timers: Array<{ callback: () => void; delay: number }> = [];
    const host = createHost({
      config: readConfig({ WAKE_SECRET: 'x'.repeat(16) }),
      queue: {
        claim: vi.fn().mockResolvedValue({ messages: [], dropped: [] }),
        ack: vi.fn(async () => undefined),
      },
      log: vi.fn(),
      query,
      readSession: () => 'stale',
      writeSession: (id) => writes.push(id),
      adapterExists: () => true,
      setTimeout: ((callback: () => void, delay: number) => {
        timers.push({ callback, delay });
        return 1;
      }) as never,
      clearTimeout: vi.fn() as never,
    });
    host.start();
    await vi.waitFor(() => expect(timers.some((timer) => timer.delay === 0)).toBe(true));
    timers.find((timer) => timer.delay === 0)!.callback();
    await vi.waitFor(() => expect(prompts).toEqual([DEFAULT_FIRST_MESSAGE]));
    expect(writes).toContain(null);
    host.stop();
  });

  it('ignores unknown messages while refreshing activity', async () => {
    let clock = 0;
    const emitted = defer();
    const timers: Array<{ callback: () => void; delay: number }> = [];
    const host = createHost({
      config: { ...readConfig({ WAKE_SECRET: 'x'.repeat(16) }), pollMs: 100, idleTimeoutMs: 50 },
      queue: {
        claim: vi.fn().mockResolvedValue({ messages: [row(6)], dropped: [] }),
        ack: vi.fn(async () => undefined),
      },
      log: vi.fn(),
      readSession: () => 'session',
      adapterExists: () => true,
      now: () => clock,
      query: (() =>
        (async function* () {
          await emitted.promise;
          yield { type: 'rate_limit_event' } as unknown as SDKMessage;
          await new Promise(() => undefined);
        })() as Query) as never,
      setTimeout: ((callback: () => void, delay: number) => {
        timers.push({ callback, delay });
        return 1;
      }) as never,
      clearTimeout: vi.fn() as never,
    });
    host.start();
    clock = 100;
    emitted.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    await vi.waitFor(() =>
      expect(timers.filter((timer) => timer.delay === 50).length).toBeGreaterThan(0),
    );
    clock = 140;
    timers
      .filter((timer) => timer.delay === 50)
      .at(-1)!
      .callback();
    expect(host.health().restarts).toBe(0);
    clock = 151;
    timers
      .filter((timer) => timer.delay === 50)
      .at(-1)!
      .callback();
    expect(host.health().restarts).toBe(1);
    host.stop();
  });

  it('does not queue a claimed id twice', async () => {
    const prompts: string[] = [];
    const result = defer();
    const query = (({ prompt }: { prompt: AsyncIterable<SDKUserMessage> }) =>
      (async function* () {
        const iterator = prompt[Symbol.asyncIterator]();
        prompts.push((await iterator.next()).value!.message.content as string);
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'session',
          tools: [],
          mcp_servers: [{ name: 'wake', status: 'connected' }],
        } as unknown as SDKMessage;
        await result.promise;
        yield {
          type: 'result',
          subtype: 'success',
          is_error: false,
          num_turns: 1,
        } as unknown as SDKMessage;
        prompts.push((await iterator.next()).value!.message.content as string);
        await new Promise(() => undefined);
      })() as Query) as never;
    const claim = vi
      .fn()
      .mockResolvedValueOnce({ messages: [row(7)], dropped: [] })
      .mockResolvedValue({ messages: [row(7), row(8)], dropped: [] });
    const ack = vi.fn(async () => undefined);
    const host = createHost({
      config: readConfig({ WAKE_SECRET: 'x'.repeat(16) }),
      queue: { claim, ack },
      log: vi.fn(),
      query,
      readSession: () => 'session',
      adapterExists: () => true,
      setTimeout: vi.fn(() => 1) as never,
      clearTimeout: vi.fn() as never,
    });
    host.start();
    await vi.waitFor(() => expect(prompts).toHaveLength(1));
    await host.tick();
    result.resolve();
    await vi.waitFor(() => expect(prompts).toHaveLength(2));
    expect(prompts[0]).toContain('event 7');
    expect(prompts[1]).toContain('event 8');
    expect(prompts[1]).not.toContain('event 7');
    expect(ack).toHaveBeenCalledWith([7]);
    host.stop();
  });

  it('ignores a buffered result from a superseded query generation', async () => {
    let clock = 0;
    let run = 0;
    const lateResult = defer();
    const currentResult = defer();
    const prompts: string[] = [];
    const query = (({ prompt }: { prompt: AsyncIterable<SDKUserMessage> }) =>
      (async function* () {
        const thisRun = ++run;
        prompts.push(
          (await prompt[Symbol.asyncIterator]().next()).value!.message.content as string,
        );
        yield {
          type: 'system',
          subtype: 'init',
          session_id: 'session',
          tools: [],
          mcp_servers: [{ name: 'wake', status: 'connected' }],
        } as unknown as SDKMessage;
        await (thisRun === 1 ? lateResult.promise : currentResult.promise);
        yield {
          type: 'result',
          subtype: 'success',
          is_error: false,
          num_turns: 1,
        } as unknown as SDKMessage;
        await new Promise(() => undefined);
      })() as Query) as never;
    const timers: Array<{ callback: () => void; delay: number }> = [];
    const ack = vi.fn(async () => undefined);
    const host = createHost({
      config: {
        ...readConfig({ WAKE_SECRET: 'x'.repeat(16) }),
        pollMs: 100,
        idleTimeoutMs: 50,
      },
      queue: {
        claim: vi
          .fn()
          .mockResolvedValueOnce({ messages: [row(8)], dropped: [] })
          .mockResolvedValue({ messages: [], dropped: [] }),
        ack,
      },
      log: vi.fn(),
      query,
      readSession: () => 'session',
      adapterExists: () => true,
      now: () => clock,
      setTimeout: ((callback: () => void, delay: number) => {
        timers.push({ callback, delay });
        return 1;
      }) as never,
      clearTimeout: vi.fn() as never,
    });
    host.start();
    await vi.waitFor(() => expect(prompts).toHaveLength(1));
    clock = 100;
    timers.find((timer) => timer.delay === 50)!.callback();
    timers.find((timer) => timer.delay === 1_000)!.callback();
    await vi.waitFor(() => expect(prompts).toHaveLength(2));
    lateResult.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(ack).not.toHaveBeenCalledWith([8]);
    currentResult.resolve();
    await vi.waitFor(() => expect(ack).toHaveBeenCalledWith([8]));
    host.stop();
  });
});

describe('planner host model limits', () => {
  function limitedHost(
    streams: Array<'event' | 'throw' | 'success' | 'pending'>,
    fallbackModel: string | null = 'fallback',
  ) {
    let clock = Date.parse('2026-09-12T08:32:00.000Z');
    const models: string[] = [];
    const timers: Array<{ callback: () => void; delay: number; cleared?: boolean }> = [];
    const query = (({ options }: { options: { model: string } }) => {
      models.push(options.model);
      const kind = streams.shift() ?? 'pending';
      return (async function* () {
        if (kind === 'event') {
          yield {
            type: 'rate_limit_event',
            rate_limit_info: { status: 'rejected', resetsAt: 1_799_949_600 },
          } as unknown as SDKMessage;
          return;
        }
        if (kind === 'throw')
          throw new Error(
            `API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"You've reached your Fable limit. Switch to another model or try again later."}}`,
          );
        if (kind === 'success') {
          yield {
            type: 'system',
            subtype: 'init',
            session_id: 'session',
            tools: [],
            mcp_servers: [{ name: 'wake', status: 'connected' }],
          } as unknown as SDKMessage;
          yield {
            type: 'result',
            subtype: 'success',
            is_error: false,
            num_turns: 1,
          } as unknown as SDKMessage;
        }
        await new Promise(() => undefined);
      })() as Query;
    }) as never;
    const host = createHost({
      config: {
        ...readConfig({
          WAKE_SECRET: 'x'.repeat(16),
          ...(fallbackModel === null ? {} : { PLANNER_HOST_FALLBACK_MODEL: fallbackModel }),
          PLANNER_HOST_MODEL_RETRY_MS: '60000',
        }),
        pollMs: 999_999,
      },
      queue: { claim: vi.fn().mockResolvedValue({ messages: [], dropped: [] }), ack: vi.fn() },
      log: vi.fn(),
      query,
      readSession: () => 'session',
      adapterExists: () => true,
      now: () => clock,
      setTimeout: ((callback: () => void, delay: number) => {
        timers.push({ callback, delay });
        return timers.length;
      }) as never,
      clearTimeout: ((id: number) => {
        if (timers[id - 1]) timers[id - 1]!.cleared = true;
      }) as never,
    });
    host.start();
    const fire = (delay: number, occurrence = 0) => {
      const timer = timers.filter((item) => item.delay === delay && !item.cleared)[occurrence];
      expect(timer).toBeDefined();
      timer!.cleared = true;
      timer!.callback();
    };
    return { host, models, timers, fire, setClock: (value: number) => (clock = value) };
  }

  it('falls back to the second model within one restart when the primary is rate limited', async () => {
    const { host, models, timers, fire } = limitedHost(['event', 'pending']);
    await vi.waitFor(() => expect(timers.some((timer) => timer.delay === 0)).toBe(true));
    fire(0);
    await vi.waitFor(() => expect(models).toEqual(['claude-fable-5-1', 'fallback']));
    expect(host.health()).toMatchObject({
      restarts: 1,
      model: 'fallback',
      modelLimited: {
        since: '2026-09-12T08:32:00.000Z',
        until: '2027-01-14T18:00:00.000Z',
        primary: 'claude-fable-5-1',
      },
    });
    host.stop();
  });

  it('falls back when the primary is refused as a thrown 429 rather than an event', async () => {
    const { host, models, timers, fire } = limitedHost(['throw', 'pending']);
    await vi.waitFor(() => expect(timers.some((timer) => timer.delay === 0)).toBe(true));
    fire(0);
    await vi.waitFor(() => expect(models.at(-1)).toBe('fallback'));
    expect(host.health()).toMatchObject({ restarts: 1, model: 'fallback' });
    host.stop();
  });

  it('backs off with the existing exponential backoff when the fallback is rate limited too', async () => {
    const expected = [
      1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 128_000, 256_000, 300_000,
    ];
    const streams: Array<'event' | 'pending'> = Array.from(
      { length: expected.length + 1 },
      () => 'event' as const,
    );
    const { host, timers, fire } = limitedHost(streams);
    await vi.waitFor(() => expect(timers.some((timer) => timer.delay === 0)).toBe(true));
    fire(0);
    for (const delay of expected) {
      await vi.waitFor(() =>
        expect(timers.some((timer) => timer.delay === delay && !timer.cleared)).toBe(true),
      );
      if (delay !== 300_000) fire(delay);
    }
    expect(host.health().model).toBe('fallback');
    expect(
      timers.filter((timer) => expected.includes(timer.delay)).map((timer) => timer.delay),
    ).toEqual(expected);
    host.stop();
  });

  it('retries the primary at the configured cadence and switches back when a turn completes', async () => {
    const { host, models, timers, fire } = limitedHost(['event', 'pending', 'success']);
    await vi.waitFor(() => expect(timers.some((timer) => timer.delay === 0)).toBe(true));
    fire(0);
    await vi.waitFor(() => expect(models.at(-1)).toBe('fallback'));
    fire(60_000);
    await vi.waitFor(() =>
      expect(timers.filter((timer) => timer.delay === 0 && !timer.cleared)).toHaveLength(1),
    );
    fire(0);
    await vi.waitFor(() => expect(host.health().modelLimited).toBeUndefined());
    expect(host.health().model).toBe('claude-fable-5-1');
    host.stop();
  });

  it('returns to the fallback when the primary probe is refused again', async () => {
    const { host, models, timers, fire } = limitedHost(['event', 'pending', 'event', 'pending']);
    await vi.waitFor(() => expect(timers.some((timer) => timer.delay === 0)).toBe(true));
    fire(0);
    await vi.waitFor(() => expect(models.at(-1)).toBe('fallback'));
    fire(60_000);
    await vi.waitFor(() =>
      expect(timers.filter((timer) => timer.delay === 0 && !timer.cleared)).toHaveLength(1),
    );
    fire(0);
    await vi.waitFor(() => expect(host.health().model).toBe('fallback'));
    expect(timers.some((timer) => timer.delay === 60_000 && !timer.cleared)).toBe(true);
    expect(host.health().modelLimited).toBeDefined();
    host.stop();
  });

  it('does not report a model limit when the primary has never been refused', async () => {
    const { host } = limitedHost(['success']);
    await vi.waitFor(() => expect(host.health().lastTurnAt).not.toBeNull());
    expect(host.health()).toMatchObject({ model: 'claude-fable-5-1', modelLimited: undefined });
    host.stop();
  });

  it('keeps backing off with no fallback configured, and still reports the limit', async () => {
    const { host, timers } = limitedHost(['event'], null);
    await vi.waitFor(() => expect(timers.some((timer) => timer.delay === 1000)).toBe(true));
    expect(host.health()).toMatchObject({ model: 'claude-fable-5-1', modelLimited: {} });
    host.stop();
  });
});
