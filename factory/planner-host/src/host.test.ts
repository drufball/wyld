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
});
