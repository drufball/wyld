import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider } from '../live/LiveEvents.js';
import { Demos } from './Demos.js';

const source = () => ({ addEventListener() {}, removeEventListener() {}, close() {} });
const demo = (id: string, status: 'ready' | 'building' | 'failed') => ({
  id,
  questId: null,
  title: `${id} disc`,
  ref: id,
  url: `/play/${id}/`,
  status,
  builtAt: status === 'ready' ? '2026-09-05T12:00:00.000Z' : null,
  error: status === 'failed' ? 'nope' : null,
  kind: 'disc' as const,
  summary: null,
  steps: [],
  seeded: [],
  deepLink: null,
  hiddenAt: null,
});
const completedQuest = {
  id: 'quest',
  worldId: 'wyld',
  title: 'Quest',
  pitch: 'Ship it',
  status: 'done' as const,
  progress: 1,
  sinceYouLooked: '',
  lastNote: '',
};
function response(value: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(value),
    text: () => Promise.resolve('nope'),
  } as Response);
}
function show(path = '/demos') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LiveEventsProvider eventSourceFactory={source}>
        <Routes>
          <Route path="/demos" element={<Demos />} />
          <Route path="/demos/:id" element={<Demos />} />
        </Routes>
      </LiveEventsProvider>
    </MemoryRouter>,
  );
}
afterEach(() => vi.unstubAllGlobals());

describe('Demos', () => {
  it('offers Hide only for questless ready cards and removes a hidden card', async () => {
    const questless = demo('main', 'ready');
    const owned = { ...demo('owned', 'ready'), questId: 'quest' };
    const fetch = vi.fn((url: string) =>
      url === '/api/demos/main/hide'
        ? response({ ...questless, hiddenAt: '2026-09-05T12:00:00.000Z' })
        : response([questless, owned]),
    );
    vi.stubGlobal('fetch', fetch);
    show();

    expect(await screen.findByRole('button', { name: 'Hide' })).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Mark done' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    await waitFor(() => expect(screen.queryByText('main disc')).toBeNull());
    expect(screen.getByText('owned disc')).not.toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      '/api/demos/main/hide',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({}) }),
    );
  });
  it('renders ready, building, and failed states and rebuilds', async () => {
    const items = [demo('main', 'ready'), demo('work', 'building'), demo('oops', 'failed')];
    const fetch = vi.fn((url: string) =>
      url === '/api/demos/build'
        ? response({ ...items[2], status: 'building', error: null })
        : response(items),
    );
    vi.stubGlobal('fetch', fetch);
    show();
    expect(await screen.findByRole('link', { name: 'Play' })).not.toBeNull();
    expect(screen.getByText('Building this now…')).not.toBeNull();
    expect(screen.getByText("This one didn't build.")).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Rebuild' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/demos/build',
        expect.objectContaining({ body: JSON.stringify({ id: 'oops' }) }),
      ),
    );
  });
  it('shows the empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response([])),
    );
    show();
    expect(await screen.findByText('Nothing to try yet.')).not.toBeNull();
  });
  it('renders a live try-it card and posts feedback without game data', async () => {
    const live = {
      ...demo('live-map', 'ready'),
      kind: 'live' as const,
      title: 'Map tools',
      summary: 'Shape a very long winding trail.',
      steps: ['Open the map', 'Place a tree'],
      seeded: ['A starter forest'],
      deepLink: '/quests?quest=map-tools',
      url: '/quests?quest=map-tools',
      builtAt: null,
    };
    const fetch = vi.fn((url: string) =>
      url === '/api/feedback' ? response({ id: 1 }) : response([live]),
    );
    vi.stubGlobal('fetch', fetch);
    show();
    expect(await screen.findByText('TRY IT')).not.toBeNull();
    expect(screen.getByText(live.summary)).not.toBeNull();
    expect(screen.getAllByRole('list')[0]?.tagName).toBe('OL');
    expect(screen.getByText('Open the map')).not.toBeNull();
    expect(screen.getByText("What's already there")).not.toBeNull();
    expect(screen.getByText('A starter forest')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Try it' }).getAttribute('href')).toBe(live.deepLink);
    fireEvent.click(screen.getByRole('button', { name: 'Feedback' }));
    const formClasses = screen.getByLabelText('What did you think?').closest('form')?.className;
    expect(formClasses).toContain('w-full');
    expect(formClasses).not.toContain('w-[min(340px,calc(100vw-24px))]');
    fireEvent.change(screen.getByLabelText('What did you think?'), { target: { value: 'Useful' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/feedback',
        expect.objectContaining({ body: JSON.stringify({ demoId: 'live-map', text: 'Useful' }) }),
      ),
    );
  });
  it('marks quest-owned live and ready disc cards done and removes them', async () => {
    const live = { ...demo('live', 'ready'), kind: 'live' as const, questId: 'live-quest' };
    const disc = { ...demo('disc', 'ready'), questId: 'disc-quest' };
    const main = demo('main', 'ready');
    const fetch = vi.fn((url: string) =>
      url.startsWith('/api/quests/')
        ? response({ ...completedQuest, id: 'live-quest' })
        : response([live, disc, main]),
    );
    vi.stubGlobal('fetch', fetch);
    show();

    const buttons = await screen.findAllByRole('button', { name: 'Mark done' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);
    await waitFor(() => expect(screen.queryByText('live disc')).toBeNull());
    expect(screen.getByText('disc disc')).not.toBeNull();
    expect(screen.getByText('main disc')).not.toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      '/api/quests/live-quest',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'done', source: 'human' }),
      }),
    );
  });

  it('keeps a card and offers retry when marking done fails', async () => {
    const owned = { ...demo('owned', 'ready'), questId: 'quest' };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => (url === '/api/demos' ? response([owned]) : response({}, false))),
    );
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark done' }));
    expect(await screen.findByRole('button', { name: 'Retry' })).not.toBeNull();
    expect(screen.getByText('owned disc')).not.toBeNull();
  });

  it('navigates back after marking a full-page quest demo done', async () => {
    const live = { ...demo('live', 'ready'), kind: 'live' as const, questId: 'quest' };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => response(url === '/api/demos' ? [live] : completedQuest)),
    );
    show('/demos/live');
    fireEvent.click(await screen.findByRole('button', { name: 'Mark done' }));
    expect(await screen.findByRole('heading', { name: 'Demos' })).not.toBeNull();
  });
  it('renders a ready Pak as a branch card with a full-navigation anchor', async () => {
    const pak = {
      ...demo('branch-pak', 'ready'),
      kind: 'pak' as const,
      title: 'Branch Pak',
      summary: 'Try the branch.',
      steps: ['Open Sleep.'],
      url: '/play/branch-pak/sleep',
      deepLink: '/sleep',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response([pak])),
    );

    show();
    expect(await screen.findByText('BRANCH')).not.toBeNull();
    const link = screen.getByRole('link', { name: 'Try it' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/play/branch-pak/sleep');
    expect(screen.getByRole('button', { name: 'Feedback' })).not.toBeNull();
  });

  it('gives building and failed Pak demos the build treatment', async () => {
    const items = [
      { ...demo('building-pak', 'building'), kind: 'pak' as const },
      { ...demo('failed-pak', 'failed'), kind: 'pak' as const },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response(items)),
    );
    show();
    expect(await screen.findByText('Building this now…')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Rebuild' })).not.toBeNull();
  });

  it('posts text-only feedback without game hooks', async () => {
    const fetch = vi.fn((url: string) =>
      url === '/api/feedback'
        ? response({
            id: 1,
            demoId: 'main',
            questId: null,
            text: 'Fun',
            state: null,
            hasScreenshot: false,
            created: '2026-09-05T12:00:00.000Z',
          })
        : response([demo('main', 'ready')]),
    );
    vi.stubGlobal('fetch', fetch);
    show('/demos/main');
    fireEvent.click(await screen.findByRole('button', { name: 'Feedback' }));
    expect(screen.getByLabelText('What did you think?').closest('form')?.className).toContain(
      'w-[min(340px,calc(100vw-24px))]',
    );
    fireEvent.change(screen.getByLabelText('What did you think?'), { target: { value: 'Fun' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/feedback',
        expect.objectContaining({ body: JSON.stringify({ demoId: 'main', text: 'Fun' }) }),
      ),
    );
    expect(await screen.findByText('Got it — thanks.')).not.toBeNull();
  });
});
