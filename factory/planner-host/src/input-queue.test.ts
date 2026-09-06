import { describe, expect, it } from 'vitest';
import { createInputQueue } from './input-queue.js';

describe('input queue', () => {
  it('yields pushed turns in order and closes', async () => {
    const queue = createInputQueue();
    queue.push('one');
    queue.push('two');
    queue.close();
    const values = [];
    for await (const value of queue) values.push(value);
    expect(values.map((value) => value.message.content)).toEqual(['one', 'two']);
    expect(values[0]).toMatchObject({
      type: 'user',
      parent_tool_use_id: null,
      message: { role: 'user' },
    });
  });
});
