import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { LiveEventsProvider } from '../live/LiveEvents.js';
import { Worlds } from './Worlds.js';

const source = () => ({ addEventListener() {}, removeEventListener() {}, close() {} });
const response = (value: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(value) } as Response);

afterEach(() => vi.unstubAllGlobals());

it('renders ordered world doors with worded non-zero quest counts', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      response([
        {
          id: 'wyld',
          name: 'WYLD',
          kind: 'game',
          order: 0,
          icon: 'tree',
          questCounts: { idea: 1, planning: 0, building: 3, demo: 0, done: 0, parked: 0 },
        },
        {
          id: 'pak',
          name: 'Expansion Pak',
          kind: 'factory',
          order: 1,
          icon: 'spark',
          questCounts: { idea: 0, planning: 0, building: 0, demo: 0, done: 1, parked: 0 },
        },
      ]),
    ),
  );
  render(
    <MemoryRouter>
      <LiveEventsProvider eventSourceFactory={source}>
        <Worlds />
      </LiveEventsProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText('Three building, one idea.')).not.toBeNull();
  expect(screen.getByText('One done.')).not.toBeNull();
  expect(screen.queryByText(/0|3/)).toBeNull();
  expect(screen.getByRole('link', { name: /WYLD/ }).getAttribute('href')).toBe('/worlds/wyld');
});
