import type { Chain } from '@wyld/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCatchup,
  getHealthSnapshot,
  getPresence,
  listChains,
  listQuests,
} from '../api/client.js';
import { Vmu } from './Vmu.js';
vi.mock('../api/client.js', () => ({
  getCatchup: vi.fn(),
  getHealthSnapshot: vi.fn(),
  getPresence: vi.fn(),
  listChains: vi.fn(),
  listQuests: vi.fn(),
}));
const base = {
  status: 'open',
  createdAt: '2026-09-05T12:00:00Z',
  lastActivityAt: '2026-09-05T12:00:00Z',
  questId: null,
  anchor: null,
  snoozedUntil: null,
  tags: [],
  demoId: null,
  payload: null,
  rumble: null,
  messages: [],
} as const;
function chain(value: Partial<Chain>): Chain {
  return { ...base, id: 1, kind: 'message', ...value } as Chain;
}
function renderVmu() {
  return render(
    <MemoryRouter>
      <Vmu />
    </MemoryRouter>,
  );
}
describe('VMU', () => {
  beforeEach(() => {
    vi.mocked(getCatchup).mockResolvedValue({
      show: false,
      awaySeconds: 0,
      unseenCount: 0,
      catchup: {
        id: 1,
        fromEventId: 0,
        toEventId: 0,
        digest: { rumbles: [], demos: [], shipped: [], fyi: [] },
        generatedBy: 'mechanical',
        createdAt: '2026-09-05T12:00:00Z',
      },
      nextAction: null,
    });
    vi.mocked(getHealthSnapshot).mockResolvedValue({
      ts: '2026-09-05T12:00:00Z',
      planner: { state: 'online' },
      server: { ok: true, db: 'ok', uptimeSeconds: 1, version: 'test', eventsToday: 0 },
      wake: { reachable: true },
      github: { ciState: 'unknown', codexPrsOpen: 0, source: 'none' },
    });
    vi.mocked(getPresence).mockResolvedValue({
      lastSeenAt: '2026-09-05T12:00:00Z',
      lastCatchupEventId: null,
      nextAction: null,
      needsYou: 0,
    });
    vi.mocked(listQuests).mockResolvedValue([]);
    vi.mocked(listChains).mockResolvedValue([]);
  });
  it('shows the needs-you headline', async () => {
    vi.mocked(getPresence).mockResolvedValue({
      lastSeenAt: '2026-09-05T12:00:00Z',
      lastCatchupEventId: null,
      nextAction: null,
      needsYou: 2,
    });
    renderVmu();
    expect(
      (await screen.findByRole('link', { name: 'two things need you' })).getAttribute('href'),
    ).toBe('/');
  });
  it('counts rumbles and ready demos from chains', async () => {
    vi.mocked(listChains).mockImplementation(async (options) =>
      options?.kind === 'rumble'
        ? [
            chain({
              kind: 'rumble',
              rumble: {
                id: 'r',
                title: 'R',
                context: 'C',
                options: ['a'],
                chosen: null,
                chosenAt: null,
                blockingQuestIds: [],
                kind: 'taste',
              },
            }),
          ]
        : [chain({ kind: 'demo', demoId: 'd', payload: { title: 'Demo', status: 'ready' } })],
    );
    renderVmu();
    expect(await screen.findByRole('link', { name: 'one Rumble' })).not.toBeNull();
    expect(await screen.findByRole('link', { name: 'one demo ready' })).not.toBeNull();
  });
  it('is quiet only when needs-you, building, and next action are empty', async () => {
    renderVmu();
    expect(await screen.findByText("Controller's quiet.")).not.toBeNull();
  });
});
