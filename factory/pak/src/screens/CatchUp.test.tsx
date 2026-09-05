import type { CatchupView } from '@wyld/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCatchup, postSeen } from '../api/client.js';
import { CatchUp } from './CatchUp.js';

vi.mock('../api/client.js', () => ({ getCatchup: vi.fn(), postSeen: vi.fn() }));
const base: CatchupView = {
  show: true,
  awaySeconds: 9000,
  unseenCount: 24,
  catchup: {
    id: 8,
    fromEventId: 1,
    toEventId: 24,
    generatedBy: 'planner',
    createdAt: '2026-09-05T12:00:00.000Z',
    digest: { rumbles: [], demos: [], shipped: [], fyi: [] },
  },
  nextAction: null,
};
function Location() {
  return <output aria-label="location">{useLocation().pathname}</output>;
}
function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/catch-up']}>
      <Location />
      <Routes>
        <Route path="/catch-up" element={<CatchUp />} />
        <Route path="/" element={<div>Today</div>} />
      </Routes>
    </MemoryRouter>,
  );
}
afterEach(() => vi.clearAllMocks());

describe('Catch-Up', () => {
  it('renders only non-empty sections in order and links deep links', async () => {
    vi.mocked(getCatchup).mockResolvedValue({
      ...base,
      catchup: {
        ...base.catchup,
        digest: {
          rumbles: [{ text: 'Choose the trail', deepLink: '/rumble' }],
          demos: [],
          shipped: [{ text: 'Map landed', deepLink: '/worlds/map' }],
          fyi: ['The forest is growing'],
        },
      },
    });
    const { container } = renderScreen();
    await screen.findByRole('heading', { name: 'Catch-Up' });
    expect(Array.from(container.querySelectorAll('h2')).map((node) => node.textContent)).toEqual([
      'Needs you',
      'Shipped',
      'Worth knowing',
    ]);
    expect(screen.queryByRole('heading', { name: 'Ready to try' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Choose the trail' }).getAttribute('href')).toBe(
      '/rumble',
    );
    expect(screen.getByRole('link', { name: 'Map landed' }).getAttribute('href')).toBe(
      '/worlds/map',
    );
  });
  it('renders the quiet copy without section headings', async () => {
    vi.mocked(getCatchup).mockResolvedValue(base);
    const { container } = renderScreen();
    expect(await screen.findByText('All quiet — nothing new to report.')).not.toBeNull();
    expect(container.querySelector('h2')).toBeNull();
  });
  it.each([false, true])('returns to Today after acknowledging (rejects: %s)', async (rejects) => {
    vi.mocked(getCatchup).mockResolvedValue(base);
    if (rejects) vi.mocked(postSeen).mockRejectedValue(new Error('offline'));
    else
      vi.mocked(postSeen).mockResolvedValue({
        lastSeenAt: '2026-09-05T12:00:00.000Z',
        lastCatchupEventId: 24,
        nextAction: null,
      });
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.getByLabelText('location').textContent).toBe('/'));
    expect(postSeen).toHaveBeenCalledTimes(1);
  });
});
