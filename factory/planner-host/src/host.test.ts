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
        await result.promise;
        yield {
          type: 'result',
          subtype: 'success',
          is_error: false,
          num_turns: 1,
        } as unknown as SDKMessage;
        const next = await Promise.race([
          iterator.next(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 20)),
        ]);
        if (next) prompts.push(next.value!.message.content as string);
        await new Promise(() => undefined);
      })() as Query) as never;
    const claim = vi.fn().mockResolvedValue({ messages: [row(7)], dropped: [] });
    const host = createHost({
      config: readConfig({ WAKE_SECRET: 'x'.repeat(16) }),
      queue: { claim, ack: vi.fn(async () => undefined) },
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
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(prompts).toHaveLength(1);
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
