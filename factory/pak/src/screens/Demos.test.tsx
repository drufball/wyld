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
        </Routes>
      </LiveEventsProvider>
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('Demos', () => {
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
  it('resolves the player by chain demoId', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response([demo('live')])),
    );
    show('/demos/live');
    expect(await screen.findByText('live summary')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Feedback' })).not.toBeNull();
  });
  it('reports an unknown demo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response([])),
    );
    show('/demos/missing');
    expect(await screen.findByText("That demo isn't here.")).not.toBeNull();
  });
});
