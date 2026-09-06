import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider, type EventSourceFactory } from '../live/LiveEvents.js';
import { ChainList } from './ChainList.js';

const timestamp = '2026-09-05T12:00:00.000Z';
const question = {
  id: 1,
  status: 'open',
  createdAt: timestamp,
  lastActivityAt: timestamp,
  questId: null,
  messages: [{ id: 1, chainId: 1, author: 'human', text: 'Why?', ts: timestamp }],
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

afterEach(() => vi.unstubAllGlobals());
describe('ChainList', () => {
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
