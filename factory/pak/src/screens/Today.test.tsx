import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider } from '../live/LiveEvents.js';
import { GoOutside, LastMemoryCard, Signals, Today } from './Today.js';

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
  it('renders the Go Outside details and optional local ETA', () => {
    const { rerender } = render(
      <MemoryRouter>
        <GoOutside
          action={{ text: 'Nothing needs you.', backAt: '2026-09-06T16:30:00.000Z' }}
          building={3}
          chainCount={0}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Cranking on three quests.')).not.toBeNull();
    expect(screen.getByText(/Back around \d{1,2}:\d{2}/)).not.toBeNull();
    rerender(
      <MemoryRouter>
        <GoOutside action={{ text: 'Nothing needs you.' }} building={0} chainCount={0} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Nothing cooking right now.')).not.toBeNull();
    expect(screen.queryByText(/Back around/)).toBeNull();
  });

  it('shows the panel for a lower-case matching action when chains and Rumbles are empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        jsonResponse(
          url === '/api/presence'
            ? { ...presence, nextAction: { text: '  nothing needs you today' } }
            : [],
        ),
      ),
    );
    const { container } = renderToday();
    await waitFor(() => expect(container.querySelector('.today-go-outside')).not.toBeNull());
  });

  it.each([
    ['different text', 'Keep going', [], []],
    [
      'an open chain',
      'Nothing needs you today',
      [
        {
          id: 1,
          kind: 'message',
          status: 'open',
          createdAt: presence.lastSeenAt,
          lastActivityAt: presence.lastSeenAt,
          questId: null,
          snoozedUntil: null,
          rumble: null,
          messages: [
            {
              id: 1,
              chainId: 1,
              author: 'human',
              text: 'Question',
              ts: presence.lastSeenAt,
            },
          ],
        },
      ],
      [],
    ],
    [
      'an open Rumble',
      'Nothing needs you today',
      [],
      [
        {
          id: 'rumble',
          title: 'Choose',
          context: 'A choice',
          options: ['A', 'B'],
          chosen: null,
          chosenAt: null,
          blockingQuestIds: [],
          kind: 'taste',
        },
      ],
    ],
  ])('does not show the panel with %s', async (_name, text, chains, rumbles) => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/presence')
          return jsonResponse({ ...presence, nextAction: { text, deepLink: '/' } });
        if (url.startsWith('/api/chains?')) return jsonResponse(chains);
        if (url.startsWith('/api/rumbles?')) return jsonResponse(rumbles);
        return jsonResponse([]);
      }),
    );
    const { container } = renderToday();
    expect(await screen.findByRole('link', { name: text })).not.toBeNull();
    await waitFor(() => expect(container.querySelector('.today-go-outside')).toBeNull());
  });
  it("links to sleep and persists dismissal of last night's Memory Card", async () => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const retro = {
      id: 1,
      date,
      summary: 'A calm night.',
      wins: [],
      misses: [],
      factoryImprovements: [],
      stats: {},
      generatedBy: 'planner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse([retro])),
    );
    const view = render(
      <MemoryRouter>
        <LastMemoryCard />
      </MemoryRouter>,
    );
    expect(
      (await screen.findByRole('link', { name: /Last night's Memory Card/ })).getAttribute('href'),
    ).toBe('/memory');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Memory Card' }));
    expect(localStorage.getItem(`pak.memory-card.dismissed.${date}`)).toBe('1');
    view.unmount();
    render(
      <MemoryRouter>
        <LastMemoryCard />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.queryByText("Last night's Memory Card")).toBeNull());
  });

  it('offers the Goodnight entry point', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse(presence)),
    );
    renderToday();
    expect(screen.getByRole('link', { name: 'Goodnight' }).getAttribute('href')).toBe('/sleep');
  });
  it('does not render the old cranking paragraph', async () => {
    const fetch = vi.fn((url: string) =>
      jsonResponse(url === '/api/quests' || url === '/api/worlds' ? [] : presence),
    );
    vi.stubGlobal('fetch', fetch);
    const { container } = renderToday();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/quests', {}));
    expect(container.querySelector('.today-cranking')).toBeNull();
    expect(fetch.mock.calls.filter(([url]) => url === '/api/presence/seen')).toHaveLength(0);
  });

  it('submits a chain on Enter, clears the field, and renders its card immediately', async () => {
    const chain = {
      id: 1,
      status: 'open',
      createdAt: presence.lastSeenAt,
      lastActivityAt: presence.lastSeenAt,
      questId: null,
      messages: [{ id: 1, chainId: 1, author: 'human', text: 'build it', ts: presence.lastSeenAt }],
    };
    const fetch = vi.fn((url: string, init?: RequestInit) =>
      url === '/api/chains' && init?.method === 'POST'
        ? jsonResponse(chain)
        : jsonResponse(url === '/api/chains' || url.startsWith('/api/quests') ? [] : presence),
    );
    vi.stubGlobal('fetch', fetch);
    renderToday();
    const field = screen.getByLabelText("What's on your mind?");
    expect(field.tagName).toBe('TEXTAREA');
    fireEvent.change(field, { target: { value: 'build it' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect((field as HTMLTextAreaElement).value).toBe('');
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/chains',
        expect.objectContaining({ body: JSON.stringify({ text: 'build it' }) }),
      ),
    );
    expect(fetch.mock.calls.filter(([url]) => url === '/api/events')).toHaveLength(0);
    expect(await screen.findByText('build it')).not.toBeNull();
  });

  it('has no mode toggle', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse(presence)),
    );
    renderToday();
    expect(screen.queryByRole('button', { name: 'Just asking?' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make something instead' })).toBeNull();
  });

  it('returns focus to the composer button after Escape without stealing focus on mount', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse(presence)),
    );
    renderToday();
    const composerButton = screen.getByRole('button', { name: 'New message' });
    expect(document.activeElement).not.toBe(composerButton);

    fireEvent.click(composerButton);
    expect(document.activeElement).toBe(screen.getByLabelText("What's on your mind?"));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.activeElement).toBe(composerButton);
  });

  it('keeps a newline and does not submit on Shift+Enter', async () => {
    const fetch = vi.fn((url: string) => {
      void url;
      return jsonResponse(presence);
    });
    vi.stubGlobal('fetch', fetch);
    renderToday();
    const field = screen.getByLabelText("What's on your mind?");
    fireEvent.change(field, { target: { value: 'first line' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    fireEvent.change(field, { target: { value: 'first line\nsecond line' } });

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch.mock.calls.filter(([url]) => url === '/api/events')).toHaveLength(0);
    expect((field as HTMLTextAreaElement).value).toBe('first line\nsecond line');
  });

  it('grows for long text and includes the vertical border width', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => jsonResponse(presence)),
    );
    renderToday();
    const field = screen.getByLabelText("What's on your mind?") as HTMLTextAreaElement;
    Object.defineProperty(field, 'scrollHeight', { configurable: true, value: 88 });
    Object.defineProperty(field, 'clientHeight', { configurable: true, value: 86 });
    Object.defineProperty(field, 'offsetHeight', { configurable: true, value: 88 });
    fireEvent.change(field, { target: { value: 'A long intent that wraps onto another line.' } });

    expect(field.style.height).toBe('90px');
  });

  it('does nothing for whitespace', async () => {
    const fetch = vi.fn((...args: Parameters<typeof globalThis.fetch>) => {
      void args;
      return jsonResponse(presence);
    });
    vi.stubGlobal('fetch', fetch);
    renderToday();
    const field = screen.getByLabelText("What's on your mind?");
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.submit(field.closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(
      fetch.mock.calls.filter(([url, init]) => url === '/api/chains' && init?.method === 'POST'),
    ).toHaveLength(0);
  });

  it('retains failed text for retry', async () => {
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      void init;
      return url === '/api/chains' ? jsonResponse({}, false) : jsonResponse(presence);
    });
    vi.stubGlobal('fetch', fetch);
    renderToday();
    const field = screen.getByLabelText("What's on your mind?");
    fireEvent.change(field, { target: { value: 'same idea' } });
    fireEvent.submit(field.closest('form')!);
    const retry = await screen.findByRole('button', { name: 'Retry' });
    fireEvent.click(retry);
    await waitFor(() =>
      expect(
        fetch.mock.calls.filter(([url, init]) => url === '/api/chains' && init?.method === 'POST'),
      ).toHaveLength(2),
    );
    expect(
      fetch.mock.calls.filter(
        ([url, init]) => url === '/api/chains' && init?.method === 'POST',
      )[1]?.[1],
    ).toEqual(expect.objectContaining({ body: expect.stringContaining('same idea') }));
  });

  it('converts a chain to an intent without changing the prompt', async () => {
    const chain = {
      id: 7,
      status: 'open',
      createdAt: presence.lastSeenAt,
      lastActivityAt: presence.lastSeenAt,
      questId: null,
      messages: [
        { id: 8, chainId: 7, author: 'human', text: 'make a map', ts: presence.lastSeenAt },
      ],
    };
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/chains?') && init?.method !== 'POST') return jsonResponse([chain]);
      if (url === '/api/chains/7/close') return jsonResponse({ ...chain, status: 'converted' });
      return jsonResponse(url.startsWith('/api/quests') ? [] : presence);
    });
    vi.stubGlobal('fetch', fetch);
    renderToday();
    const field = screen.getByLabelText("What's on your mind?") as HTMLTextAreaElement;
    fireEvent.click(await screen.findByRole('button', { name: 'Reply or settle' }));
    fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Make this a quest' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/events',
        expect.objectContaining({
          body: JSON.stringify({
            source: 'human',
            kind: 'human.intent',
            payload: { text: 'make a map' },
          }),
        }),
      ),
    );
    expect(field.value).toBe('');
  });

  it('retries a failed chain conversion as an intent', async () => {
    const chain = {
      id: 9,
      status: 'open',
      createdAt: presence.lastSeenAt,
      lastActivityAt: presence.lastSeenAt,
      questId: null,
      messages: [
        { id: 10, chainId: 9, author: 'human', text: 'build a bridge', ts: presence.lastSeenAt },
      ],
    };
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/chains?') && init?.method !== 'POST') return jsonResponse([chain]);
      if (url === '/api/chains/9/close') return jsonResponse({ ...chain, status: 'converted' });
      if (url === '/api/events') return jsonResponse({}, false);
      return jsonResponse(url.startsWith('/api/quests') ? [] : presence);
    });
    vi.stubGlobal('fetch', fetch);
    renderToday();
    fireEvent.click(await screen.findByRole('button', { name: 'Reply or settle' }));
    fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Make this a quest' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(fetch.mock.calls.filter(([url]) => url === '/api/events')).toHaveLength(2),
    );
    expect(
      fetch.mock.calls.filter(([url, init]) => url === '/api/chains' && init?.method === 'POST'),
    ).toHaveLength(0);
    expect(fetch.mock.calls.filter(([url]) => url === '/api/events')[1]?.[1]).toEqual(
      expect.objectContaining({ body: expect.stringContaining('build a bridge') }),
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
    const { container, rerender } = render(
      <MemoryRouter>
        <Signals rumbles={0} demos={0} memory={null} />
      </MemoryRouter>,
    );
    expect(container.innerHTML).toBe('');
    rerender(
      <MemoryRouter>
        <Signals rumbles={12} demos={1} memory={null} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: '9+ Rumbles' }).getAttribute('href')).toBe('/rumble');
    expect(screen.getByRole('link', { name: '1 demos ready' }).getAttribute('href')).toBe('/demos');
  });
});
