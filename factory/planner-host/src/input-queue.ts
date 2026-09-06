import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

export function createInputQueue(): AsyncIterable<SDKUserMessage> & {
  push(text: string): void;
  close(): void;
} {
  const values: SDKUserMessage[] = [];
  const waiters: Array<() => void> = [];
  let closed = false;
  return {
    push(text) {
      if (closed) return;
      values.push({
        type: 'user',
        message: { role: 'user', content: text },
        parent_tool_use_id: null,
      });
      waiters.shift()?.();
    },
    close() {
      closed = true;
      for (const wake of waiters.splice(0)) wake();
    },
    async *[Symbol.asyncIterator]() {
      while (true) {
        const value = values.shift();
        if (value) {
          yield value;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => waiters.push(resolve));
      }
    },
  };
}
