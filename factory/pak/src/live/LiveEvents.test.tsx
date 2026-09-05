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
  it('keeps one connection while dispatching events and unsubscribes on unmount', () => {
    const source = new FakeEventSource();
    const factory = vi.fn(() => source);
    const handler = vi.fn();
    const view = render(
      <LiveEventsProvider eventSourceFactory={factory}>
        <Subscriber handler={handler} />
      </LiveEventsProvider>,
    );
    const event = (id: number) =>
      JSON.stringify({
        id,
        ts: '2026-09-05T12:00:00Z',
        source: 'human',
        kind: 'human.intent',
        payload: { text: 'hello' },
      });
    act(() => {
      source.dispatchEvent(new Event('open'));
      source.dispatchEvent(new Event('open'));
      source.dispatchEvent(new MessageEvent('event', { data: event(1) }));
      source.dispatchEvent(new MessageEvent('event', { data: event(2) }));
      source.dispatchEvent(new MessageEvent('event', { data: event(3) }));
    });
    expect(handler.mock.calls).toEqual([[1], [2], [3]]);
    expect(factory).toHaveBeenCalledOnce();
    view.unmount();
    act(() => source.dispatchEvent(new MessageEvent('event', { data: event(4) })));
    expect(handler).toHaveBeenCalledTimes(3);
    expect(source.close).toHaveBeenCalledOnce();
  });

  it('keeps one default connection while receiving events', () => {
    const constructorSpy = vi.fn();
    const sources: FakeGlobalEventSource[] = [];
    class FakeGlobalEventSource extends FakeEventSource {
      constructor(url: string) {
        super();
        constructorSpy(url);
        sources.push(this);
      }
    }
    vi.stubGlobal('EventSource', FakeGlobalEventSource);

    render(<LiveEventsProvider>content</LiveEventsProvider>);
    const data = JSON.stringify({
      id: 1,
      ts: '2026-09-05T12:00:00Z',
      source: 'human',
      kind: 'human.intent',
      payload: { text: 'hello' },
    });
    act(() => {
      sources[0]?.dispatchEvent(new MessageEvent('event', { data }));
      sources[0]?.dispatchEvent(new MessageEvent('event', { data }));
      sources[0]?.dispatchEvent(new MessageEvent('event', { data }));
    });

    expect(constructorSpy).toHaveBeenCalledOnce();
  });
});
