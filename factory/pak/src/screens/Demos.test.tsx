import type { Chain } from '@wyld/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider } from '../live/LiveEvents.js';
import { Demos } from './Demos.js';

const source = () => ({ addEventListener() {}, removeEventListener() {}, close() {} });
const now = '2026-09-05T12:00:00Z';

function demo(id: string, extra: Partial<Chain> = {}): Chain {
  return {
    id: Math.floor(Math.random() * 10000) + 1,
    kind: 'demo',
    status: 'open',
    createdAt: now,
    lastActivityAt: now,
    questId: null,
    anchor: null,
    snoozedUntil: null,
    tags: ['demo'],
    demoId: id,
    payload: {
      title: id,
      kind: 'live',
      summary: `${id} summary`,
      steps: ['One'],
      seeded: ['Seed'],
      deepLink: '/sleep',
      url: '/sleep',
      status: 'ready',
      builtAt: now,
      error: null,
    },
    rumble: null,
    messages: [],
    ...extra,
  };
}

function response(value: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(value),
    text: () => Promise.resolve(''),
  } as Response);
}

function show(path = '/demos') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LiveEventsProvider eventSourceFactory={source}>
        <Routes>
          <Route path="/demos/:id?" element={<Demos />} />
          <Route path="/" element={<p>home screen</p>} />
          <Route path="/sleep" element={<p>sleep screen</p>} />
        </Routes>
      </LiveEventsProvider>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('Demos', () => {
  it('labels hidden demos that reopen done quests and keeps snoozed demos as Unsnooze', async () => {
    const chains = [
      demo('done-hidden', { status: 'settled', questId: 'done-quest' }),
      demo('demo-hidden', { status: 'settled', questId: 'demo-quest' }),
      demo('later', { snoozedUntil: '2099-01-01T00:00:00Z' }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        response(
          url.startsWith('/api/quests?')
            ? [
                {
                  id: 'done-quest',
                  worldId: 'wyld',
                  title: 'Done quest',
                  pitch: 'Finished work',
                  status: 'done',
                  progress: 1,
                  sinceYouLooked: '',
                  lastNote: '',
                },
              ]
            : chains,
        ),
      ),
    );
    show();

    fireEvent.click(await screen.findByText('Hidden (2)'));
    fireEvent.click(screen.getByText('Snoozed (1)'));

    expect(screen.getByRole('button', { name: 'Show again (reopens the quest)' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Show again' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Unsnooze' })).not.toBeNull();
  });

  it('falls back to Show again when loading done quests fails', async () => {
    const chain = demo('hidden', { status: 'settled', questId: 'done-quest' });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.startsWith('/api/quests?') ? Promise.reject(new Error('offline')) : response([chain]),
      ),
    );
    show();

    fireEvent.click(await screen.findByText('Hidden (1)'));

    expect(screen.getByRole('button', { name: 'Show again' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /reopens the quest/ })).toBeNull();
  });

  it('reloads the chain list exactly once after snoozing from a demo card menu', async () => {
    const chain = demo('snooze-once');
    const fetch = vi.fn((url: string, init?: RequestInit) =>
      url.includes('/snooze') && init?.method === 'POST'
        ? response({ ...chain, snoozedUntil: '2099-01-01T00:00:00Z' })
        : response(url.startsWith('/api/quests?') ? [] : [chain]),
    );
    vi.stubGlobal('fetch', fetch);
    show();
    await screen.findByText('snooze-once summary');
    const before = fetch.mock.calls.filter(([url]) => url.startsWith('/api/chains?')).length;

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Snooze' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tomorrow morning' }));

    await waitFor(() =>
      expect(fetch.mock.calls.filter(([url]) => url.startsWith('/api/chains?'))).toHaveLength(
        before + 1,
      ),
    );
    expect(fetch.mock.calls.filter(([url]) => url.startsWith('/api/chains?'))).toHaveLength(
      before + 1,
    );
  });

  it('renders chain-backed demo details and closes with the right reason', async () => {
    const chains = [demo('owned', { questId: 'quest' }), demo('loose')];
    const fetch = vi.fn((...args: [string, RequestInit?]) =>
      response(args[0].includes('/close') ? { ...chains[0], status: 'settled' } : chains),
    );
    vi.stubGlobal('fetch', fetch);
    show();
    expect(await screen.findByText('owned summary')).not.toBeNull();
    expect(screen.getAllByText('One')).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(
          ([url, init]) => String(url).includes('/close') && String(init?.body).includes('done'),
        ),
      ).toBe(true),
    );
    expect(
      fetch.mock.calls.some(
        ([url, init]) => String(url).includes('/close') && String(init?.body).includes('settled'),
      ),
    ).toBe(true);
  });

  it('offers a retry when closing a demo fails and retries the close request', async () => {
    const chain = demo('retry');
    let closeAttempts = 0;
    const fetch = vi.fn((url: string) => {
      if (url.includes('/close')) {
        closeAttempts += 1;
        return closeAttempts === 1
          ? Promise.reject(new Error('offline'))
          : response({ ...chain, status: 'settled' });
      }
      return response([chain]);
    });
    vi.stubGlobal('fetch', fetch);
    show();

    fireEvent.click(await screen.findByRole('button', { name: 'Hide' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(closeAttempts).toBe(2));
  });

  it('offers a retry when snoozing a demo fails and retries the snooze request', async () => {
    const chain = demo('retry-snooze');
    let snoozeAttempts = 0;
    const fetch = vi.fn((url: string) => {
      if (url.includes('/snooze')) {
        snoozeAttempts += 1;
        return snoozeAttempts === 1
          ? Promise.reject(new Error('offline'))
          : response({ ...chain, snoozedUntil: '2099-01-01T00:00:00Z' });
      }
      return response([chain]);
    });
    vi.stubGlobal('fetch', fetch);
    show();

    fireEvent.click((await screen.findAllByRole('button', { name: 'More actions' }))[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Snooze' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Tomorrow morning' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(snoozeAttempts).toBe(2));
  });

  it('shows hidden and snoozed folds and restores their chains', async () => {
    const chains = [
      demo('hidden', { status: 'settled' }),
      demo('later', { snoozedUntil: '2099-01-01T00:00:00Z' }),
    ];
    const fetch = vi.fn((url: string) =>
      response(
        url.includes('/reopen') || url.includes('/unsnooze')
          ? { ...chains[0], status: 'open' }
          : chains,
      ),
    );
    vi.stubGlobal('fetch', fetch);
    show();
    expect(await screen.findByText('Hidden (1)')).not.toBeNull();
    expect(screen.getByText('Snoozed (1)')).not.toBeNull();
    const wakeTime = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date('2099-01-01T00:00:00Z'));
    expect(screen.getByText(`Wakes ${wakeTime}`)).not.toBeNull();
    expect(screen.queryByText('Wakes just now')).toBeNull();
    fireEvent.click(screen.getByText('Hidden (1)'));
    fireEvent.click(screen.getByRole('button', { name: 'Show again' }));
    await waitFor(() =>
      expect(fetch.mock.calls.some(([url]) => String(url).includes('/reopen'))).toBe(true),
    );
  });
  it('redirects a live demo to its deep link', async () => {
    const chain = demo('one-mechanism');
    chain.payload = { ...chain.payload!, deepLink: '/' };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response([chain])),
    );
    show('/demos/one-mechanism');
    expect(await screen.findByText('home screen')).not.toBeNull();
    expect(screen.queryByRole('iframe')).toBeNull();
  });

  it('plays a disc in the iframe', async () => {
    const chain = demo('a-disc');
    chain.payload = { ...chain.payload!, kind: 'disc' };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response([chain])),
    );
    show('/demos/a-disc');
    expect((await screen.findByTitle('a-disc')).getAttribute('src')).toBe('/play/a-disc/');
  });

  it('sends an unknown demo back to the demos grid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response([])),
    );
    show('/demos/missing');
    expect(await screen.findByText('Nothing to try yet.')).not.toBeNull();
  });

  it('sends a branch Pak demo to its url', async () => {
    const chain = demo('branch');
    chain.payload = { ...chain.payload!, kind: 'pak', url: '/play/branch/' };
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, replace });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response([chain])),
    );
    show('/demos/branch');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/play/branch/'));
  });
});
