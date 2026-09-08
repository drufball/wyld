import type { Chain } from '@wyld/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider, type EventSourceFactory } from '../live/LiveEvents.js';
import { ChainCard, ChainList } from './ChainList.js';

const timestamp = '2026-09-05T12:00:00.000Z';
const question = {
  id: 1,
  status: 'open',
  createdAt: timestamp,
  lastActivityAt: timestamp,
  questId: null,
  snoozedUntil: null,
  pinnedAt: null,
  tags: [],
  demoId: null,
  payload: null,
  rumble: null,
  anchor: null,
  messages: [{ id: 1, chainId: 1, author: 'human', text: 'Why?', ts: timestamp }],
} as const;
const unlock = {
  ...question,
  id: 42,
  kind: 'unlock',
  tags: ['unlock'],
  payload: { achievementId: 'first-light', name: 'First Light', badge: '☀️' },
  messages: [],
} as const;
function response(value: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(value) } as Response);
}
function renderList(
  eventSourceFactory: EventSourceFactory = () => ({
    addEventListener() {},
    removeEventListener() {},
    close() {},
  }),
) {
  return render(
    <LiveEventsProvider eventSourceFactory={eventSourceFactory}>
      <ChainList />
    </LiveEventsProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('ChainList', () => {
  const briefing = {
    ...question,
    id: 50,
    kind: 'briefing',
    pinnedAt: timestamp,
    tags: ['briefing'],
    payload: {
      rumbles: [{ text: 'Choose a trail', deepLink: '/rumble' }],
      demos: [{ text: 'Try the arena', deepLink: '/rumble' }],
      shipped: [{ text: 'Map shipped', deepLink: '/quests' }],
      fyi: ['Factory is healthy'],
      fromEventId: 2,
      toEventId: 9,
      updatedAt: timestamp,
    },
    messages: [{ id: 50, chainId: 50, author: 'planner', text: 'Morning briefing', ts: timestamp }],
  } as Chain;

  const rumble = (id: number, title: string, kind: 'outage' | 'taste' = 'taste') =>
    ({
      ...question,
      id,
      kind: 'rumble',
      tags: ['rumble'],
      slug: `rumble-${id}`,
      rumble: {
        id: `rumble-${id}`,
        title,
        context: title,
        options: ['A', 'B'],
        chosen: null,
        chosenAt: null,
        blockingQuestIds: [],
        kind,
      },
      messages: [],
    }) as Chain;

  const renderOrdered = (chains: Chain[]) => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => response(url.startsWith('/api/chains?') ? chains : [])),
    );
    return render(
      <MemoryRouter>
        <LiveEventsProvider
          eventSourceFactory={() => ({
            addEventListener() {},
            removeEventListener() {},
            close() {},
          })}
        >
          <ChainList kind="all" />
        </LiveEventsProvider>
      </MemoryRouter>,
    );
  };

  it('renders the briefing sections with tappable lines and dismisses as read', async () => {
    const fetch = vi.fn((url: string) =>
      url === '/api/chains/50/close' ? response({ ...briefing, status: 'settled' }) : response([]),
    );
    vi.stubGlobal('fetch', fetch);
    render(
      <MemoryRouter>
        <ChainCard chain={briefing} onChange={() => undefined} onClosed={() => undefined} />
      </MemoryRouter>,
    );

    for (const heading of ['Waiting on you', 'Ready to try', 'Shipped', 'Worth knowing'])
      expect(screen.getByRole('heading', { name: heading })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Choose a trail' }).getAttribute('href')).toBe(
      '/rumble',
    );
    expect(screen.getByRole('link', { name: 'Choose a trail' }).className).toContain('underline');
    expect(screen.getByRole('heading', { name: 'Waiting on you' }).className).toContain(
      'font-display',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/chains/50/close',
        expect.objectContaining({ body: JSON.stringify({ reason: 'read', source: 'human' }) }),
      ),
    );
  });

  it('does not render a demo chain', async () => {
    const rumble = {
      ...question,
      id: 51,
      kind: 'rumble',
      tags: ['rumble'],
      slug: 'choose-one',
      rumble: {
        id: 'choose-one',
        title: 'Choose one',
        context: 'A choice',
        options: ['A', 'B'],
        chosen: null,
        chosenAt: null,
        blockingQuestIds: [],
        kind: 'taste',
      },
      messages: [],
    } as Chain;
    const demo = {
      ...question,
      id: 52,
      kind: 'demo',
      tags: ['demo'],
      demoId: 'demo-one',
      payload: {
        title: 'Demo one',
        kind: 'live',
        summary: 'Try demo one',
        steps: [],
        seeded: [],
        deepLink: '/roadmap',
        url: '/roadmap',
        status: 'ready',
        builtAt: timestamp,
        error: null,
      },
      messages: [{ id: 52, chainId: 52, author: 'planner', text: 'Try demo one', ts: timestamp }],
    } as Chain;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        response(url.startsWith('/api/chains?') ? [rumble, demo, briefing] : []),
      ),
    );

    const { container } = render(
      <MemoryRouter>
        <LiveEventsProvider
          eventSourceFactory={() => ({
            addEventListener() {},
            removeEventListener() {},
            close() {},
          })}
        >
          <ChainList kind="all" />
        </LiveEventsProvider>
      </MemoryRouter>,
    );

    await screen.findByText('Morning briefing');
    expect(container.querySelector('.chain-card')?.textContent).toContain('Morning briefing');
    expect(screen.queryByText('Try demo one')).toBeNull();
  });

  it('shows a Look button on a look chain', () => {
    render(
      <MemoryRouter>
        <ChainCard
          chain={
            {
              ...question,
              kind: 'message',
              payload: { explainer: 'species-grid' },
              tags: ['look'],
              messages: [...question.messages],
            } as Chain
          }
          defaultOpen
          onChange={() => undefined}
          onClosed={() => undefined}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Look' }).getAttribute('href')).toBe(
      '/explain/species-grid',
    );
  });

  it('pinned chains sort above every unpinned card', async () => {
    const pinnedQuestion = {
      ...question,
      id: 53,
      kind: 'question',
      pinnedAt: timestamp,
      tags: [],
      messages: [{ ...question.messages[0], id: 53, chainId: 53, text: 'Pinned question' }],
    } as Chain;
    const { container } = renderOrdered([rumble(54, 'Outage rumble', 'outage'), pinnedQuestion]);

    await screen.findByText('Pinned question');
    expect([...container.querySelectorAll('.chain-card')].map((card) => card.textContent)).toEqual([
      expect.stringContaining('Pinned question'),
      expect.stringContaining('Outage rumble'),
    ]);
  });

  it('unpinned cards keep their existing order', async () => {
    const unpinnedQuestion = {
      ...question,
      id: 58,
      kind: 'question',
      lastActivityAt: '2026-09-05T15:00:00.000Z',
      tags: [],
      messages: [{ ...question.messages[0], id: 58, chainId: 58, text: 'Question card' }],
    } as Chain;
    const { container } = renderOrdered([
      unpinnedQuestion,
      rumble(59, 'Regular rumble'),
      rumble(60, 'Outage rumble', 'outage'),
    ]);

    await screen.findByText('Question card');
    expect([...container.querySelectorAll('.chain-card')].map((card) => card.textContent)).toEqual([
      expect.stringContaining('Outage rumble'),
      expect.stringContaining('Regular rumble'),
      expect.stringContaining('Question card'),
    ]);
  });

  function unlockFetch(closeResult: 'success' | 'failure' = 'success') {
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/chains/42/close' && init?.method === 'POST')
        return closeResult === 'success'
          ? response({ ...unlock, status: 'settled' })
          : Promise.reject(new Error('offline'));
      if (url.startsWith('/api/chains?')) return response([unlock]);
      if (url === '/api/quests') return response([]);
      return response([]);
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  const closeCalls = (fetch: ReturnType<typeof vi.fn>) =>
    fetch.mock.calls.filter(([url]) => url === '/api/chains/42/close');

  const renderUnlock = () =>
    render(
      <LiveEventsProvider
        eventSourceFactory={() => ({ addEventListener() {}, removeEventListener() {}, close() {} })}
      >
        <ChainList kind="unlock" />
      </LiveEventsProvider>,
    );

  it('automatically settles and removes an unlock after eight seconds', async () => {
    vi.useFakeTimers();
    const fetch = unlockFetch();
    renderUnlock();
    await act(async () => Promise.resolve());
    expect(screen.getByRole('button', { name: 'Settled' })).not.toBeNull();

    await act(async () => vi.advanceTimersByTimeAsync(8_000));

    expect(closeCalls(fetch)).toEqual([
      [
        '/api/chains/42/close',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'settled', source: 'planner' }),
        }),
      ],
    ]);
    expect(screen.queryByText(/Achievement unlocked/)).toBeNull();
  });

  it.each([
    ['card body', () => document.querySelector('.unlock-card p')!],
    ['Settled button', () => screen.getByRole('button', { name: 'Settled' })],
  ])('settles an unlock once from the %s', async (_label, target) => {
    vi.useFakeTimers();
    const fetch = unlockFetch();
    renderUnlock();
    await act(async () => Promise.resolve());

    fireEvent.click(target());
    await act(async () => Promise.resolve());
    await act(async () => vi.advanceTimersByTimeAsync(8_000));

    expect(closeCalls(fetch)).toHaveLength(1);
    expect(screen.queryByText(/Achievement unlocked/)).toBeNull();
  });

  it('does not settle an unlock after it is unmounted', async () => {
    vi.useFakeTimers();
    const fetch = unlockFetch();
    const view = renderUnlock();
    await act(async () => Promise.resolve());
    view.unmount();

    await act(async () => vi.advanceTimersByTimeAsync(8_000));

    expect(closeCalls(fetch)).toHaveLength(0);
  });

  it('waits for a full visible interval before automatically settling an unlock', async () => {
    vi.useFakeTimers();
    const fetch = unlockFetch();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    renderUnlock();
    await act(async () => Promise.resolve());

    await act(async () => vi.advanceTimersByTimeAsync(8_000));
    expect(closeCalls(fetch)).toHaveLength(0);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fireEvent(document, new Event('visibilitychange'));
    await act(async () => vi.advanceTimersByTimeAsync(8_000));

    expect(closeCalls(fetch)).toHaveLength(1);
  });

  it('keeps a failed unlock close visible for manual retry without another automatic attempt', async () => {
    vi.useFakeTimers();
    const fetch = unlockFetch('failure');
    renderUnlock();
    await act(async () => Promise.resolve());

    await act(async () => vi.advanceTimersByTimeAsync(8_000));
    expect(screen.getByRole('button', { name: 'Retry' })).not.toBeNull();
    expect(document.querySelector('.unlock-card')).not.toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(8_000));

    expect(closeCalls(fetch)).toHaveLength(1);
  });
  const renderCard = (
    anchor: { artifact: string; element: string; label: string } | null,
    artifactName?: string,
  ) =>
    render(
      <MemoryRouter>
        <ChainCard
          chain={{
            ...question,
            kind: 'question',
            anchor,
            tags: [...question.tags],
            messages: [...question.messages],
          }}
          artifactName={artifactName}
          onChange={() => undefined}
          onClosed={() => undefined}
        />
      </MemoryRouter>,
    );

  it('links an anchored chain to its named artifact', () => {
    renderCard({ artifact: 'forest-map', element: 'hero', label: 'Hero title' }, 'Forest map');

    const link = screen.getByRole('link', { name: 'Pinned to Hero title · Forest map' });
    expect(link.getAttribute('href')).toBe('/explain/forest-map');
  });

  it('falls back to the artifact slug in an anchored chain link', () => {
    renderCard({ artifact: 'forest-map', element: 'hero', label: 'Hero title' });

    const link = screen.getByRole('link', { name: 'Pinned to Hero title · forest-map' });
    expect(link.getAttribute('href')).toBe('/explain/forest-map');
  });

  it('does not render a pinned link for an unanchored chain', () => {
    renderCard(null);

    expect(screen.queryByRole('link', { name: /Pinned to/ })).toBeNull();
  });

  it('does not add an action chain after a live planner update when kind is all', async () => {
    let receive: EventListener | undefined;
    const action = { ...question, id: 2, kind: 'action', messages: [] };
    let chainRequests = 0;
    const fetch = vi.fn((url: string) => {
      if (!url.startsWith('/api/chains')) return response([]);
      chainRequests += 1;
      return response(chainRequests === 1 ? [question] : [question, action]);
    });
    vi.stubGlobal('fetch', fetch);
    const { container } = render(
      <LiveEventsProvider
        eventSourceFactory={() => ({
          addEventListener(type, listener) {
            if (type === 'event') receive = listener as EventListener;
          },
          removeEventListener() {},
          close() {},
        })}
      >
        <ChainList kind="all" />
      </LiveEventsProvider>,
    );
    await screen.findByText('Why?');
    expect(container.querySelectorAll('.chain-card')).toHaveLength(1);

    act(() => {
      receive?.(
        new MessageEvent('event', {
          data: JSON.stringify({
            id: 9,
            ts: timestamp,
            source: 'planner',
            kind: 'planner.chain_updated',
            payload: { chainId: 2 },
          }),
        }),
      );
    });

    await waitFor(() => expect(chainRequests).toBe(2));
    expect(container.querySelectorAll('.chain-card')).toHaveLength(1);
  });

  it('adds a question chain after a live planner update when kind is all', async () => {
    let receive: EventListener | undefined;
    let chainRequests = 0;
    const fetch = vi.fn((url: string) => {
      if (!url.startsWith('/api/chains')) return response([]);
      chainRequests += 1;
      return response(chainRequests === 1 ? [] : [question]);
    });
    vi.stubGlobal('fetch', fetch);
    render(
      <LiveEventsProvider
        eventSourceFactory={() => ({
          addEventListener(type, listener) {
            if (type === 'event') receive = listener as EventListener;
          },
          removeEventListener() {},
          close() {},
        })}
      >
        <ChainList kind="all" />
      </LiveEventsProvider>,
    );
    await waitFor(() => expect(chainRequests).toBe(1));

    act(() => {
      receive?.(
        new MessageEvent('event', {
          data: JSON.stringify({
            id: 10,
            ts: timestamp,
            source: 'planner',
            kind: 'planner.chain_updated',
            payload: { chainId: 1 },
          }),
        }),
      );
    });

    expect(await screen.findByText('Why?')).not.toBeNull();
  });

  it('requests every renderable kind when kind is all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response([])),
    );
    render(
      <LiveEventsProvider
        eventSourceFactory={() => ({ addEventListener() {}, removeEventListener() {}, close() {} })}
      >
        <ChainList kind="all" />
      </LiveEventsProvider>,
    );

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/chains?kind=question%2Cmessage%2Crumble%2Cunlock%2Cbriefing',
        {},
      ),
    );
  });

  it('omits the kind query and filters action chains when kind is not provided', async () => {
    const action = { ...question, kind: 'action', messages: [] };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => response(url === '/api/chains' ? [action] : [])),
    );
    const { container } = renderList();

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('/api/chains', {}));
    expect(container.querySelector('.today-chains')).toBeNull();
    expect(container.querySelector('.chain-card')).toBeNull();
  });

  it('renders nothing when there are no chains', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => response(url === '/api/chains' ? [] : [])),
    );
    const { container } = renderList();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('/api/chains', {}));
    expect(container.querySelector('.today-chains')).toBeNull();
  });

  it('renders messages and only shows a chip for a targeted chain', async () => {
    const answered = {
      ...question,
      messages: [
        ...question.messages,
        { id: 2, chainId: 1, author: 'planner', text: 'Because.', ts: timestamp },
      ],
    };
    const targeted = {
      ...question,
      id: 2,
      questId: 'quest-one',
      messages: [{ ...question.messages[0], id: 3, chainId: 2, text: 'Quest question' }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        response(
          url === '/api/chains'
            ? [answered, targeted]
            : [
                {
                  id: 'quest-one',
                  worldId: 'wyld',
                  title: 'Named quest',
                  pitch: 'A pitch',
                  status: 'building',
                  progress: 0,
                  sinceYouLooked: '',
                  lastNote: '',
                },
              ],
        ),
      ),
    );
    renderList();
    expect(await screen.findByText('Why?')).not.toBeNull();
    expect(screen.getByText('Because.')).not.toBeNull();
    expect(await screen.findByText('Named quest')).not.toBeNull();
    expect(screen.getAllByText(/Named quest/)).toHaveLength(1);
  });

  it('reloads for a live planner update', async () => {
    let receive: EventListener | undefined;
    const fetch = vi.fn((url: string) => response(url === '/api/chains' ? [question] : []));
    vi.stubGlobal('fetch', fetch);
    renderList(() => ({
      addEventListener(type, listener) {
        if (type === 'event') receive = listener as EventListener;
      },
      removeEventListener() {},
      close() {},
    }));
    await screen.findByText('Why?');
    receive?.(
      new MessageEvent('event', {
        data: JSON.stringify({
          id: 9,
          ts: timestamp,
          source: 'planner',
          kind: 'planner.chain_updated',
          payload: { chainId: 1 },
        }),
      }),
    );
    await waitFor(() =>
      expect(fetch.mock.calls.filter(([url]) => url === '/api/chains')).toHaveLength(2),
    );
  });

  it('settles a chain and posts a follow-up to that chain', async () => {
    const followed = {
      ...question,
      messages: [
        ...question.messages,
        { id: 2, chainId: 1, author: 'human', text: 'More?', ts: timestamp },
      ],
    };
    const fetch = vi.fn((url: string, init?: RequestInit) =>
      response(
        init?.method === 'POST' && url.endsWith('/messages')
          ? followed
          : url === '/api/chains'
            ? [question]
            : init?.method === 'POST'
              ? { ...question, status: 'settled' }
              : [],
      ),
    );
    vi.stubGlobal('fetch', fetch);
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: 'Reply or settle' }));
    const field = screen.getByLabelText('Follow up');
    fireEvent.change(field, { target: { value: 'More?' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/chains/1/messages',
        expect.objectContaining({ body: JSON.stringify({ author: 'human', text: 'More?' }) }),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Settled' }));
    await waitFor(() => expect(screen.queryByText('Why?')).toBeNull());
  });

  it('collapses responses and expands from the chevron or card body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => response(url === '/api/chains' ? [question] : [])),
    );
    const { container } = renderList();
    await screen.findByText('Why?');
    expect(screen.queryByLabelText('Follow up')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settled' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reply or settle' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Follow up'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByLabelText('Follow up')).toBeNull();

    fireEvent.click(container.querySelector('.chain-card p')!);
    expect(document.activeElement).toBe(screen.getByLabelText('Follow up'));
  });

  it('hides arrow glyphs and keeps more actions beside Settled only while open', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => response(url === '/api/chains' ? [question] : [])),
    );
    const { container } = renderList();
    await screen.findByText('Why?');

    expect(
      screen
        .queryAllByRole('button')
        .some(({ textContent }) => ['⌄', '⌃'].includes(textContent ?? '')),
    ).toBe(false);
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reply or settle' }));
    const actions = container.querySelector('#chain-actions-1');
    const settled = screen.getByRole('button', { name: 'Settled' });
    const moreActions = screen.getByRole('button', { name: 'More actions' });
    expect(actions?.contains(settled)).toBe(true);
    expect(actions?.contains(moreActions)).toBe(true);
    expect(settled.parentElement).toBe(moreActions.parentElement);
    expect(settled.parentElement?.className).toContain('justify-end');
  });

  it('opens the actions menu, snoozes with presets, and closes on Escape', async () => {
    const fetch = vi.fn((url: string, init?: RequestInit) =>
      response(url === '/api/chains' ? [question] : init?.method === 'POST' ? question : []),
    );
    vi.stubGlobal('fetch', fetch);
    render(
      <LiveEventsProvider
        eventSourceFactory={() => ({ addEventListener() {}, removeEventListener() {}, close() {} })}
      >
        <ChainList onConvert={() => undefined} />
      </LiveEventsProvider>,
    );
    await screen.findByText('Why?');
    fireEvent.click(screen.getByRole('button', { name: 'Reply or settle' }));
    const trigger = screen.getByRole('button', { name: 'More actions' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menuitem', { name: 'Make this a quest' })).not.toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Snooze' }));
    expect(screen.getByRole('menuitem', { name: 'Later today' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Tomorrow morning' })).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Next week' })).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Snooze' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tomorrow morning' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/chains/1/snooze',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers Pin, updates to Unpin, and shows the pinned glyph', async () => {
    const pinned = { ...question, pinnedAt: timestamp };
    const fetch = vi.fn((url: string, init?: RequestInit) =>
      response(url === '/api/chains' ? [question] : init?.method === 'POST' ? pinned : []),
    );
    vi.stubGlobal('fetch', fetch);
    renderList();
    await screen.findByText('Why?');
    fireEvent.click(screen.getByRole('button', { name: 'Reply or settle' }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pin' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/chains/1/pin', { method: 'POST' }),
    );

    expect(await screen.findByText('Pinned')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Unpin' })).not.toBeNull();
  });

  it('lets the next card click toggle after an outside click closes the actions menu', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => response(url === '/api/chains' ? [question] : [])),
    );
    const { container } = renderList();
    await screen.findByText('Why?');

    fireEvent.click(screen.getByRole('button', { name: 'Reply or settle' }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menu')).not.toBeNull();
    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(container.querySelector('.chain-card p')!);
    expect(screen.queryByLabelText('Follow up')).toBeNull();
  });

  it('suppresses the quest chip and does not load quest names when requested', async () => {
    const targeted = { ...question, questId: 'quest-one' };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => response(url.startsWith('/api/chains') ? [targeted] : [])),
    );
    const { container } = render(
      <LiveEventsProvider
        eventSourceFactory={() => ({
          addEventListener() {},
          removeEventListener() {},
          close() {},
        })}
      >
        <ChainList quest="quest-one" showQuestChip={false} />
      </LiveEventsProvider>,
    );
    expect(await screen.findByText('Why?')).not.toBeNull();
    expect(container.querySelector('.chain-card .world-tag')).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/chains?quest=quest-one', {});
    expect(globalThis.fetch).not.toHaveBeenCalledWith('/api/quests', {});
  });

  it('does not reload a quest-scoped list for another quest event', async () => {
    let receive: EventListener | undefined;
    const targeted = { ...question, questId: 'quest-one' };
    const fetch = vi.fn((url: string) => response(url.startsWith('/api/chains') ? [targeted] : []));
    vi.stubGlobal('fetch', fetch);
    render(
      <LiveEventsProvider
        eventSourceFactory={() => ({
          addEventListener(type, listener) {
            if (type === 'event') receive = listener as EventListener;
          },
          removeEventListener() {},
          close() {},
        })}
      >
        <ChainList quest="quest-one" />
      </LiveEventsProvider>,
    );
    await screen.findByText('Why?');
    expect(fetch.mock.calls.filter(([url]) => url === '/api/chains?quest=quest-one')).toHaveLength(
      1,
    );

    receive?.(
      new MessageEvent('event', {
        data: JSON.stringify({
          id: 10,
          ts: timestamp,
          source: 'planner',
          kind: 'planner.chain_updated',
          questId: 'quest-two',
          payload: { chainId: 2 },
        }),
      }),
    );

    expect(fetch.mock.calls.filter(([url]) => url === '/api/chains?quest=quest-one')).toHaveLength(
      1,
    );
  });
});
