import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider } from '../live/LiveEvents.js';
import { Signals, Today } from './Today.js';

const source = () => ({ addEventListener() {}, removeEventListener() {}, close() {} });
const presence = { lastSeenAt: '2026-09-05T12:00:00Z', lastCatchupEventId: null, nextAction: null };
function jsonResponse(value: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(value),
    text: () => Promise.resolve('nope'),
  } as Response);
}
function renderToday(signals?: { rumbles: number; demos: number; memory: string | null }) {
  return render(
    <MemoryRouter>
      <LiveEventsProvider eventSourceFactory={source}>
        <Today signals={signals} />
      </LiveEventsProvider>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());
describe('Today', () => {
  it('quietly shows the building quest count in words', async () => {
    const buildingQuest = {
      id: 'map',
      worldId: 'wyld',
      title: 'Map',
      pitch: 'Chart it.',
      status: 'building',
      progress: 0,
      sinceYouLooked: '',
      lastNote: '',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        jsonResponse(url === '/api/quests?status=building' ? [buildingQuest] : presence),
      ),
    );
    renderToday();
    expect(await screen.findByText('Cranking on one quest.')).not.toBeNull();
  });

  it('posts an intent and clears the field', async () => {
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'POST' && _url === '/api/events'
        ? jsonResponse({
            id: 2,
            ts: presence.lastSeenAt,
            source: 'human',
            kind: 'human.intent',
            payload: { text: 'build it' },
          })
        : jsonResponse(presence),
    );
    vi.stubGlobal('fetch', fetch);
    renderToday();
    const field = screen.getByLabelText('What do we make today?');
    fireEvent.change(field, { target: { value: 'build it' } });
    fireEvent.submit(field.closest('form')!);
    expect((field as HTMLInputElement).value).toBe('');
    await waitFor(() => expect(screen.getByText('Got it.')).not.toBeNull());
    expect(fetch).toHaveBeenCalledWith(
      '/api/events',
      expect.objectContaining({
        body: JSON.stringify({
          source: 'human',
          kind: 'human.intent',
          payload: { text: 'build it' },
        }),
      }),
    );
  });

  it('does nothing for whitespace', async () => {
    const fetch = vi.fn((...args: Parameters<typeof globalThis.fetch>) => {
      void args;
      return jsonResponse(presence);
    });
    vi.stubGlobal('fetch', fetch);
    renderToday();
    const field = screen.getByLabelText('What do we make today?');
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.submit(field.closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch.mock.calls.filter(([url]) => url === '/api/events')).toHaveLength(0);
  });

  it('retains failed text for retry', async () => {
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      void init;
      return url === '/api/events' ? jsonResponse({}, false) : jsonResponse(presence);
    });
    vi.stubGlobal('fetch', fetch);
    renderToday();
    const field = screen.getByLabelText('What do we make today?');
    fireEvent.change(field, { target: { value: 'same idea' } });
    fireEvent.submit(field.closest('form')!);
    const retry = await screen.findByRole('button', { name: 'Retry' });
    fireEvent.click(retry);
    await waitFor(() =>
      expect(fetch.mock.calls.filter(([url]) => url === '/api/events')).toHaveLength(2),
    );
    expect(fetch.mock.calls.filter(([url]) => url === '/api/events')[1]?.[1]).toEqual(
      expect.objectContaining({ body: expect.stringContaining('same idea') }),
    );
  });

  it('renders one presence action and omits it when null', async () => {
    const fetch = vi.fn((url: string) =>
      jsonResponse(
        url === '/api/presence'
          ? { ...presence, nextAction: { text: 'Try demo', deepLink: '/demos' } }
          : presence,
      ),
    );
    vi.stubGlobal('fetch', fetch);
    renderToday();
    expect((await screen.findByRole('link', { name: 'Try demo' })).getAttribute('href')).toBe(
      '/demos',
    );
  });

  it('renders no signals at zero and caps visible counts', () => {
    const { container, rerender } = render(<Signals rumbles={0} demos={0} memory={null} />);
    expect(container.innerHTML).toBe('');
    rerender(<Signals rumbles={12} demos={1} memory={null} />);
    expect(screen.getByText('9+ Rumbles')).not.toBeNull();
    expect(screen.getByText('1 demos ready')).not.toBeNull();
  });
});
