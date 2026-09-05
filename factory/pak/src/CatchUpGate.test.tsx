import type { CatchupView } from '@wyld/shared';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCatchup, postSeen } from './api/client.js';
import { CatchUpGate } from './CatchUpGate.js';

vi.mock('./api/client.js', () => ({ getCatchup: vi.fn(), postSeen: vi.fn() }));

const view: CatchupView = {
  show: false,
  awaySeconds: 0,
  unseenCount: 0,
  catchup: {
    id: 1,
    fromEventId: 0,
    toEventId: 0,
    digest: { rumbles: [], demos: [], shipped: [], fyi: [] },
    generatedBy: 'mechanical',
    createdAt: '2026-09-05T12:00:00.000Z',
  },
  nextAction: null,
};
function Location() {
  return <output aria-label="location">{useLocation().pathname}</output>;
}
function renderGate(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Location />
      <Routes>
        <Route
          path="*"
          element={
            <CatchUpGate>
              <div>children</div>
            </CatchUpGate>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}
afterEach(() => vi.clearAllMocks());

describe('CatchUpGate', () => {
  it('redirects when catch-up is ready without acknowledging', async () => {
    vi.mocked(getCatchup).mockResolvedValue({ ...view, show: true });
    renderGate();
    expect(screen.queryByText('children')).toBeNull();
    await waitFor(() => expect(screen.getByLabelText('location').textContent).toBe('/catch-up'));
    expect(postSeen).not.toHaveBeenCalled();
  });
  it('shows children and acknowledges when catch-up is not due', async () => {
    vi.mocked(getCatchup).mockResolvedValue(view);
    renderGate();
    expect(await screen.findByText('children')).not.toBeNull();
    expect(postSeen).toHaveBeenCalledTimes(1);
  });
  it('fails open without navigating or acknowledging', async () => {
    vi.mocked(getCatchup).mockRejectedValue(new Error('offline'));
    renderGate();
    expect(await screen.findByText('children')).not.toBeNull();
    expect(screen.getByLabelText('location').textContent).toBe('/');
    expect(postSeen).not.toHaveBeenCalled();
  });
  it('does not loop when already on catch-up', async () => {
    vi.mocked(getCatchup).mockResolvedValue({ ...view, show: true });
    renderGate('/catch-up');
    expect(await screen.findByText('children')).not.toBeNull();
    expect(getCatchup).toHaveBeenCalledTimes(1);
    expect(postSeen).not.toHaveBeenCalled();
  });
});
