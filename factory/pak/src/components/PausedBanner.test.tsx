import type { HealthSnapshot } from '@wyld/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getHealthSnapshot, postResume } from '../api/client.js';
import { useLiveEvents } from '../live/LiveEvents.js';
import { PausedBanner } from './PausedBanner.js';

vi.mock('../api/client.js', () => ({ getHealthSnapshot: vi.fn(), postResume: vi.fn() }));
vi.mock('../live/LiveEvents.js', () => ({ useLiveEvents: vi.fn() }));

const healthy: HealthSnapshot = {
  ts: '2026-09-05T12:00:00.000Z',
  planner: { state: 'online' },
  server: { ok: true, db: 'ok', uptimeSeconds: 1, version: 'test', eventsToday: 0 },
  wake: { reachable: true },
  github: { ciState: 'unknown', codexPrsOpen: 0, source: 'none' },
};
const paused: HealthSnapshot = {
  ...healthy,
  planner: { state: 'paused' },
  wake: { reachable: true, queueDepth: 4 },
  paused: {
    lane: 'codex',
    reason: 'Codex quota hit',
    fix: 'It refills within the hour',
    since: '2026-09-05T02:14:00.000Z',
  },
};
const expectedTime = new Date(paused.paused!.since).toLocaleTimeString([], {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

describe('PausedBanner', () => {
  const handlers = new Map<string, () => void>();

  beforeEach(() => {
    handlers.clear();
    vi.mocked(useLiveEvents).mockReturnValue({
      connected: true,
      subscribe: vi.fn((kind, handler) => {
        handlers.set(kind, handler);
        return () => handlers.delete(kind);
      }),
    });
  });

  it('renders no wrapper when the factory is running', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue(healthy);
    const { container } = render(<PausedBanner />);
    await waitFor(() => expect(getHealthSnapshot).toHaveBeenCalledOnce());
    expect(container.innerHTML).toBe('');
  });

  it('shows the pause, queue, fix, and refreshes for live events', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValueOnce(paused).mockResolvedValueOnce(healthy);
    const { container } = render(<PausedBanner />);

    expect(
      await screen.findByText(
        `Paused — Codex quota hit at ${expectedTime}. Nothing lost; four events queued. It refills within the hour.`,
      ),
    ).not.toBeNull();
    expect(container.querySelector('.paused-banner')?.getAttribute('data-tone')).toBe('bad');
    handlers.get('system.resumed')?.();
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('resumes and clears the banner after re-fetching', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValueOnce(paused).mockResolvedValueOnce(healthy);
    vi.mocked(postResume).mockResolvedValue({ resumed: 1 });
    const { container } = render(<PausedBanner />);

    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }));
    expect((screen.getByRole('button', { name: 'Resume' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await waitFor(() => expect(container.innerHTML).toBe(''));
    expect(postResume).toHaveBeenCalledOnce();
  });

  it('keeps the banner and explains a resume failure', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue(paused);
    vi.mocked(postResume).mockRejectedValue(new Error('Resuming factory failed (503)'));
    render(<PausedBanner />);

    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }));
    expect(await screen.findByText(/Resuming factory failed \(503\)\./)).not.toBeNull();
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Resume' }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
  });
});
