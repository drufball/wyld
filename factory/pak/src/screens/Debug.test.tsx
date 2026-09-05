import type { HealthSnapshot } from '@wyld/shared';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHealthSnapshot } from '../api/client.js';
import { Debug } from './Debug.js';

vi.mock('../api/client.js', () => ({ getHealthSnapshot: vi.fn() }));

const snapshot: HealthSnapshot = {
  ts: '2026-09-05T12:00:00.000Z',
  planner: {
    state: 'working',
    currentTask: 'Polishing the forest',
    lastReportAt: new Date().toISOString(),
  },
  wake: {
    reachable: true,
    queueDepth: 2,
    oldestPendingTs: new Date().toISOString(),
    lastGithubEventAt: new Date().toISOString(),
  },
  server: { ok: true, db: 'ok', uptimeSeconds: 8040, version: '1.2.3', eventsToday: 17 },
  github: { ciState: 'pass', codexPrsOpen: 3 },
  costToday: 12.34,
};

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Debug', () => {
  it('renders every tile from a full snapshot', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue(snapshot);
    render(<Debug />);

    await screen.findByText('Polishing the forest', { exact: false });
    for (const label of [
      'Planner',
      'Wake',
      'Webhook feed',
      'Server',
      'Events today',
      'Checks',
      'Work in flight',
      'Spend today',
    ]) {
      expect(screen.getByRole('heading', { name: label })).not.toBeNull();
    }
    expect(screen.getByText('$12.34')).not.toBeNull();
  });

  it('omits spend and uses a dash when work count is absent', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue({
      ...snapshot,
      costToday: undefined,
      github: { ciState: 'pass' },
    });
    render(<Debug />);

    const work = (await screen.findByRole('heading', { name: 'Work in flight' })).closest(
      'section',
    )!;
    expect(within(work).getByText('—')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: 'Spend today' })).toBeNull();
  });

  it('marks a down planner and unreachable Wake as bad', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue({
      ...snapshot,
      planner: { state: 'down' },
      wake: { reachable: false },
    });
    render(<Debug />);

    for (const label of ['Planner', 'Wake']) {
      const tile = (await screen.findByRole('heading', { name: label })).closest('section');
      expect(tile?.getAttribute('data-tone')).toBe('bad');
    }
  });

  it('only shows the pause banner when there is a reason', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue({ ...snapshot, pausedReason: 'Needs a human' });
    const view = render(<Debug />);
    expect(await screen.findByText('Paused — Needs a human')).not.toBeNull();

    vi.mocked(getHealthSnapshot).mockResolvedValue(snapshot);
    view.unmount();
    render(<Debug />);
    await screen.findByRole('heading', { name: 'Planner' });
    expect(screen.queryByText(/^Paused —/)).toBeNull();
  });

  it('keeps the last snapshot when a poll fails', async () => {
    vi.useFakeTimers();
    vi.mocked(getHealthSnapshot)
      .mockResolvedValueOnce(snapshot)
      .mockRejectedValueOnce(new Error('offline'));
    render(<Debug />);
    await act(async () => Promise.resolve());
    expect(screen.getByText('Polishing the forest', { exact: false })).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText('Polishing the forest', { exact: false })).not.toBeNull();
    expect(screen.getByText("Can't reach the factory right now")).not.toBeNull();
  });
});
