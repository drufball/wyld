import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider } from '../live/LiveEvents.js';
import { playSound } from '../lib/feedback.js';
import { Sleep } from './Sleep.js';

vi.mock('../lib/feedback.js', () => ({ playSound: vi.fn() }));

const schedule = {
  goodnightAt: '2026-09-06T23:00:00Z',
  lastCallAt: '2026-09-07T05:00:00Z',
  lightsOnAt: '2026-09-07T07:00:00Z',
};
const source = () => ({ addEventListener() {}, removeEventListener() {}, close() {} });
const response = (value: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => value,
    text: async () => '',
  } as Response);
afterEach(() => vi.unstubAllGlobals());

describe('Sleep', () => {
  it('starts Goodnight without confirmation', async () => {
    const run = {
      id: 1,
      started: '2026-09-06T23:00:00Z',
      ended: null,
      trigger: 'human',
      phases: [],
      alarmsFired: ['goodnight'],
      outcome: null,
      leftoversParked: [],
    };
    let started = false;
    const fetch = vi.fn((url: string) => {
      if (url === '/api/sleep/goodnight') {
        started = true;
        return response(run);
      }
      return response(
        url === '/api/sleep/current'
          ? { run: started ? run : null, schedule }
          : url.includes('runs')
            ? []
            : run,
      );
    });
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('confirm', vi.fn());
    render(
      <MemoryRouter>
        <LiveEventsProvider eventSourceFactory={source}>
          <Sleep />
        </LiveEventsProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'GOODNIGHT' }));
    expect(playSound).toHaveBeenCalledWith('power-off');
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/sleep/goodnight',
        expect.objectContaining({ body: JSON.stringify({ trigger: 'human' }) }),
      ),
    );
    expect(confirm).not.toHaveBeenCalled();
  });

  it('shows an open run phase list and countdown', async () => {
    const run = {
      id: 1,
      started: '2026-09-06T23:00:00Z',
      ended: null,
      trigger: 'human',
      phases: [{ phase: 'drain', at: '2026-09-06T23:01:00Z' }],
      alarmsFired: ['goodnight'],
      outcome: null,
      leftoversParked: [],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => response({ run, schedule })),
    );
    render(
      <MemoryRouter>
        <LiveEventsProvider eventSourceFactory={source}>
          <Sleep />
        </LiveEventsProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('list', { name: 'Night phases' })).not.toBeNull();
    expect(screen.getByText(/to lights on/)).not.toBeNull();
    expect(screen.getByText('drain').closest('li')?.getAttribute('aria-current')).toBe('step');
    expect(screen.queryByText('AHEAD')).toBeNull();
    expect(screen.queryByRole('button', { name: 'GOODNIGHT' })).toBeNull();
  });
});
