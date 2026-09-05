import type { HealthSnapshot } from '@wyld/shared';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHealthSnapshot } from '../api/client.js';
import { compactCount, Debug } from './Debug.js';

vi.mock('../api/client.js', () => ({ getHealthSnapshot: vi.fn() }));

const now = new Date('2026-09-05T12:00:00.000Z');
const snapshot: HealthSnapshot = {
  ts: now.toISOString(),
  planner: {
    state: 'working',
    currentTask: 'Polishing the forest',
    lastReportAt: '2026-09-05T11:59:30.000Z',
  },
  wake: {
    reachable: true,
    queueDepth: 0,
    lastDeliveryAt: '2026-09-05T11:59:00.000Z',
    lastGithubEventAt: '2026-09-05T11:59:00.000Z',
  },
  server: { ok: true, db: 'ok', uptimeSeconds: 9060, version: '1.2.3', eventsToday: 1234 },
  github: {
    ciState: 'pass',
    ciDetail: 'The latest build passed',
    codexPrsOpen: 3,
    rateRemaining: 4987,
    rateLimit: 5000,
    reportedAt: '2026-09-05T11:59:00.000Z',
    source: 'ops',
  },
  tokensToday: 1_234_567,
  costToday: 12.34,
};

function tile(label: string) {
  return screen.getByRole('heading', { name: label }).closest('section')!;
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('compactCount', () => {
  it('formats small, thousand, and million counts', () => {
    expect(compactCount(985)).toBe('985');
    expect(compactCount(12_400)).toBe('12.4k');
    expect(compactCount(1_200_000)).toBe('1.2M');
  });
});

describe('Debug', () => {
  it('renders all ten plain-language tiles from an all-healthy snapshot', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.mocked(getHealthSnapshot).mockResolvedValue(snapshot);
    render(<Debug />);
    await act(async () => Promise.resolve());

    const labels = [
      'Am I awake?',
      'Are my messages getting through?',
      'Is GitHub talking to me?',
      'Is the factory running?',
      'Things that happened today',
      'Are the tests passing?',
      'Waiting on the robot',
      'Room left with GitHub',
      'Thinking done today',
      'Spent today',
    ];
    expect(labels.every((label) => screen.getByRole('heading', { name: label }))).toBe(true);
    expect(within(tile('Are my messages getting through?')).getByText('Yes')).not.toBeNull();
    expect(within(tile('Things that happened today')).getByText('1,234')).not.toBeNull();
    expect(within(tile('Room left with GitHub')).getByText('4,987')).not.toBeNull();
    expect(within(tile('Thinking done today')).getByText('1.2M')).not.toBeNull();
    expect(within(tile('Spent today')).getByText('$12.34')).not.toBeNull();
    expect(screen.getByText('The latest build passed')).not.toBeNull();
  });

  it('marks a jammed message channel as stuck', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.mocked(getHealthSnapshot).mockResolvedValue({
      ...snapshot,
      wake: {
        reachable: true,
        queueDepth: 3,
        oldestPendingTs: '2026-09-05T11:48:00.000Z',
        lastDeliveryAt: '2026-09-05T11:47:00.000Z',
      },
    });
    render(<Debug />);
    await act(async () => Promise.resolve());

    const channel = tile('Are my messages getting through?');
    expect(within(channel).getByText('Stuck')).not.toBeNull();
    expect(
      within(channel).getByText(
        '3 waiting, nothing delivered since 12m ago — the channel is jammed',
      ),
    ).not.toBeNull();
    expect(channel.getAttribute('data-tone')).toBe('bad');
  });

  it('shows a reachable, moving channel as healthy', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue({
      ...snapshot,
      wake: { reachable: true, queueDepth: 2, oldestPendingTs: new Date().toISOString() },
    });
    render(<Debug />);
    await screen.findByText('2 waiting', { exact: false });
    expect(within(tile('Are my messages getting through?')).getByText('Yes')).not.toBeNull();
  });

  it('marks a down planner and unreachable channel as bad', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue({
      ...snapshot,
      planner: { state: 'down' },
      wake: { reachable: false },
    });
    render(<Debug />);
    await screen.findByText('Asleep');

    expect(tile('Am I awake?').getAttribute('data-tone')).toBe('bad');
    const channel = tile('Are my messages getting through?');
    expect(within(channel).getByText('No')).not.toBeNull();
    expect(within(channel).getByText('the message channel is down')).not.toBeNull();
    expect(channel.getAttribute('data-tone')).toBe('bad');
  });

  it('marks GitHub as quiet when its last event is more than an hour old', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.mocked(getHealthSnapshot).mockResolvedValue({
      ...snapshot,
      wake: { ...snapshot.wake, lastGithubEventAt: '2026-09-05T10:59:00.000Z' },
    });
    render(<Debug />);
    await act(async () => Promise.resolve());

    const github = tile('Is GitHub talking to me?');
    expect(within(github).getByText('Quiet')).not.toBeNull();
    expect(within(github).getByText('last heard 1h ago')).not.toBeNull();
    expect(github.getAttribute('data-tone')).toBe('warn');
  });

  it('shows no GitHub signal when the channel is unreachable or no event has arrived', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue({
      ...snapshot,
      wake: { reachable: false },
    });
    const view = render(<Debug />);
    await screen.findByText('No signal');

    let github = tile('Is GitHub talking to me?');
    expect(within(github).getByText('nothing yet')).not.toBeNull();
    expect(github.getAttribute('data-tone')).toBe('bad');

    vi.mocked(getHealthSnapshot).mockResolvedValue({
      ...snapshot,
      wake: { ...snapshot.wake, lastGithubEventAt: undefined },
    });
    view.unmount();
    render(<Debug />);
    await screen.findByText('No signal');

    github = tile('Is GitHub talking to me?');
    expect(within(github).getByText('nothing yet')).not.toBeNull();
    expect(github.getAttribute('data-tone')).toBe('bad');
  });

  it('renders honest placeholders when no ops measurements exist', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue({
      ...snapshot,
      github: { ciState: 'unknown', source: 'none' },
      tokensToday: undefined,
      costToday: undefined,
    });
    render(<Debug />);
    await screen.findByText("Don't know");

    expect(within(tile('Are the tests passing?')).getByText("Don't know")).not.toBeNull();
    expect(tile('Are the tests passing?').hasAttribute('data-tone')).toBe(false);
    expect(within(tile('Room left with GitHub')).getByText('—')).not.toBeNull();
    expect(within(tile('Thinking done today')).getByText('Not measured')).not.toBeNull();
    expect(tile('Thinking done today').hasAttribute('data-tone')).toBe(false);
    expect(within(tile('Spent today')).getByText('Not measured')).not.toBeNull();
    expect(
      within(tile('Spent today')).getByText(
        'no honest dollar figure to read yet — nothing is capped',
      ),
    ).not.toBeNull();
  });

  it('only shows the pause banner when there is a reason', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue({ ...snapshot, pausedReason: 'Needs a human' });
    const view = render(<Debug />);
    expect(await screen.findByText('Paused — Needs a human')).not.toBeNull();

    vi.mocked(getHealthSnapshot).mockResolvedValue(snapshot);
    view.unmount();
    render(<Debug />);
    await screen.findByRole('heading', { name: 'Am I awake?' });
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
