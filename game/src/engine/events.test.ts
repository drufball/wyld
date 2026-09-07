import { describe, expect, it, vi } from 'vitest';

import { createEventBus } from './events.js';

describe('event bus', () => {
  it('subscribes, emits, and unsubscribes', () => {
    type Events = { greeting: { message: string } };
    const bus = createEventBus<Events>();
    const listener = vi.fn();
    const unsubscribe = bus.on('greeting', listener);
    bus.emit('greeting', { message: 'hello' });
    expect(listener).toHaveBeenCalledWith({ message: 'hello' });
    unsubscribe();
    bus.emit('greeting', { message: 'again' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
