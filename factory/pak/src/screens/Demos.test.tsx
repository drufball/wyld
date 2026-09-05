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
});
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
    expect(await screen.findByText('No discs yet.')).not.toBeNull();
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
