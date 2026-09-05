import { act, render, screen, waitFor } from '@testing-library/react';
import type { Quest } from '@wyld/shared';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider } from '../live/LiveEvents.js';
import { InFlight } from './InFlight.js';

const building = {
  id: 'map',
  worldId: 'wyld',
  title: 'Map the Wyld',
  pitch: 'Chart it.',
  status: 'building',
  progress: 0.42,
  sinceYouLooked: 'The northern path is connected.',
  lastNote: '',
} as const;
const world = {
  id: 'wyld',
  name: 'WYLD',
  kind: 'game',
  order: 0,
  icon: 'tree',
  questCounts: { idea: 0, planning: 0, building: 1, demo: 0, done: 0, parked: 0 },
};
let liveListener: EventListener | undefined;
const source = () => ({
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'event') liveListener = listener as EventListener;
  },
  removeEventListener() {},
  close() {},
});
const response = (value: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(value),
    text: () => Promise.resolve(''),
  } as Response);
function renderInFlight(fetch: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetch);
  return render(
    <MemoryRouter>
      <LiveEventsProvider eventSourceFactory={source}>
        <InFlight />
      </LiveEventsProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  liveListener = undefined;
});

describe('InFlight', () => {
  it('renders nothing when no quest is building or in demo', async () => {
    const excluded = (['idea', 'planning', 'parked', 'done'] as const).map((status) => ({
      ...building,
      id: status,
      status,
    }));
    const { container } = renderInFlight(
      vi.fn((url: string) => response(url === '/api/worlds' ? [world] : excluded)),
    );
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('renders building and demo cards in API order with context, progress, and links', async () => {
    const demo = {
      ...building,
      id: 'demo-map',
      title: 'Demo the map',
      status: 'demo' as const,
      sinceYouLooked: '',
      pitch: 'Ready to explore.',
      progress: 0.9,
    };
    const excluded = { ...building, id: 'idea', title: 'Just an idea', status: 'idea' as const };
    renderInFlight(
      vi.fn((url: string) =>
        response(url === '/api/worlds' ? [world] : [building, demo, excluded]),
      ),
    );

    expect(await screen.findByText('Cranking on two quests.')).not.toBeNull();
    expect(screen.getByText(building.sinceYouLooked)).not.toBeNull();
    expect(screen.getByText(demo.pitch)).not.toBeNull();
    expect(screen.queryByText(excluded.title)).toBeNull();
    expect(
      screen.getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-valuenow')),
    ).toEqual(['42', '90']);
    expect(screen.getByRole('link', { name: /Map the Wyld/ }).getAttribute('href')).toBe(
      '/quests?quest=map',
    );
  });

  it('reloads quests after a planner update', async () => {
    let quests: Quest[] = [building];
    const fetch = vi.fn((url: string) => response(url === '/api/worlds' ? [world] : quests));
    renderInFlight(fetch);
    expect(await screen.findByText(building.title)).not.toBeNull();
    quests = [{ ...building, title: 'Updated map' }];

    act(() => {
      liveListener?.(
        new MessageEvent('event', {
          data: JSON.stringify({
            id: 1,
            ts: '2026-09-05T12:00:00.000Z',
            source: 'planner',
            kind: 'planner.quest_updated',
            questId: building.id,
            payload: {},
          }),
        }),
      );
    });

    expect(await screen.findByText('Updated map')).not.toBeNull();
    expect(fetch.mock.calls.filter(([url]) => url === '/api/quests')).toHaveLength(2);
  });
});
