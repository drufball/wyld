import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider, useLiveEvents } from './LiveEvents.js';

class FakeEventSource extends EventTarget {
  close = vi.fn();
}

function Subscriber({ handler }: { handler: (id: number) => void }) {
  const { subscribe } = useLiveEvents();
  useEffect(() => subscribe('human.intent', (event) => handler(event.id)), [handler, subscribe]);
  return null;
}

describe('useLiveEvents', () => {
  it('dispatches events by kind and unsubscribes on unmount', () => {
    const source = new FakeEventSource();
    const handler = vi.fn();
    const view = render(
      <LiveEventsProvider eventSourceFactory={() => source}>
        <Subscriber handler={handler} />
      </LiveEventsProvider>,
    );
    const data = JSON.stringify({
      id: 1,
      ts: '2026-09-05T12:00:00Z',
      source: 'human',
      kind: 'human.intent',
      payload: { text: 'hello' },
    });
    act(() => source.dispatchEvent(new MessageEvent('event', { data })));
    expect(handler).toHaveBeenCalledWith(1);
    view.unmount();
    act(() => source.dispatchEvent(new MessageEvent('event', { data })));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(source.close).toHaveBeenCalledOnce();
  });
});
