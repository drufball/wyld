import type { CatchupView } from '@wyld/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCatchup,
  getHealthSnapshot,
  listDemos,
  listQuests,
  listRumbles,
} from '../api/client.js';
import { Vmu } from './Vmu.js';
vi.mock('../api/client.js', () => ({
  getCatchup: vi.fn(),
  getHealthSnapshot: vi.fn(),
  listQuests: vi.fn(),
  listRumbles: vi.fn(),
  listDemos: vi.fn(),
}));
const view: CatchupView = {
  show: true,
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
  nextAction: { text: 'Try the grove', deepLink: '/demos' },
};
const quest = {
  id: 'map',
  worldId: 'wyld',
  title: 'Map',
  pitch: 'Chart it',
  status: 'building',
  progress: 0,
  sinceYouLooked: '',
  lastNote: '',
} as const;
function renderScreen() {
  return render(
    <MemoryRouter>
      <Vmu />
    </MemoryRouter>,
  );
}
afterEach(() => vi.clearAllMocks());
describe('VMU', () => {
  beforeEach(() => {
    vi.mocked(getHealthSnapshot).mockResolvedValue({
      ts: '2026-09-05T12:00:00.000Z',
      planner: { state: 'online' },
      server: { ok: true, db: 'ok', uptimeSeconds: 1, version: 'test', eventsToday: 0 },
      wake: { reachable: true },
      github: { ciState: 'unknown', codexPrsOpen: 0, source: 'none' },
    });
  });

  it('puts a paused link first when the factory is paused', async () => {
    vi.mocked(getHealthSnapshot).mockResolvedValue({
      ts: '2026-09-05T12:00:00.000Z',
      planner: { state: 'paused' },
      server: { ok: true, db: 'ok', uptimeSeconds: 1, version: 'test', eventsToday: 0 },
      wake: { reachable: true },
      github: { ciState: 'unknown', codexPrsOpen: 0, source: 'none' },
      paused: { lane: 'codex', reason: 'Quota hit', since: '2026-09-05T02:14:00.000Z' },
    });
    vi.mocked(getCatchup).mockResolvedValue({ ...view, show: false, nextAction: null });
    vi.mocked(listQuests).mockResolvedValue([]);
    vi.mocked(listRumbles).mockResolvedValue([]);
    vi.mocked(listDemos).mockResolvedValue([]);
    const { container } = renderScreen();

    const pausedLink = await screen.findByRole('link', { name: 'Paused?' });
    expect(pausedLink.getAttribute('href')).toBe('/rumble');
    expect(container.querySelectorAll('a')[0]).toBe(pausedLink);
  });
  it('shows catch-up, the next action, and cranking work', async () => {
    vi.mocked(getCatchup).mockResolvedValue(view);
    vi.mocked(listQuests).mockResolvedValue([quest]);
    vi.mocked(listRumbles).mockResolvedValue([]);
    vi.mocked(listDemos).mockResolvedValue([]);
    renderScreen();
    expect((await screen.findByRole('link', { name: 'Catch-Up ready' })).getAttribute('href')).toBe(
      '/catch-up',
    );
    expect(screen.getByRole('link', { name: 'Try the grove' }).getAttribute('href')).toBe('/demos');
    expect(screen.getByText('Cranking on one quest.')).not.toBeNull();
  });
  it('omits catch-up when not due', async () => {
    vi.mocked(getCatchup).mockResolvedValue({ ...view, show: false });
    vi.mocked(listQuests).mockResolvedValue([quest]);
    vi.mocked(listRumbles).mockResolvedValue([]);
    vi.mocked(listDemos).mockResolvedValue([]);
    renderScreen();
    await screen.findByText('Cranking on one quest.');
    expect(screen.queryByText('Catch-Up ready')).toBeNull();
  });
  it('shows the quiet state when nothing needs attention', async () => {
    vi.mocked(getCatchup).mockResolvedValue({ ...view, show: false, nextAction: null });
    vi.mocked(listQuests).mockResolvedValue([]);
    vi.mocked(listRumbles).mockResolvedValue([]);
    vi.mocked(listDemos).mockResolvedValue([]);
    renderScreen();
    expect(await screen.findByText("Controller's quiet.")).not.toBeNull();
  });
  it('counts the open rumbles returned by the default filtered request', async () => {
    vi.mocked(getCatchup).mockResolvedValue({ ...view, show: false, nextAction: null });
    vi.mocked(listQuests).mockResolvedValue([]);
    vi.mocked(listRumbles).mockResolvedValue([
      {
        id: 'single-rumble',
        title: 'Pick one',
        context: 'Only one decision is open.',
        options: ['A', 'B'],
        chosen: null,
        chosenAt: null,
        blockingQuestIds: [],
        kind: 'taste',
      },
      {
        id: 'second-rumble',
        title: 'Pick another',
        context: 'Another decision is open.',
        options: ['A', 'B'],
        chosen: null,
        chosenAt: null,
        blockingQuestIds: [],
        kind: 'taste',
      },
    ]);
    vi.mocked(listDemos).mockResolvedValue([]);
    renderScreen();
    expect((await screen.findByRole('link', { name: 'two Rumbles' })).getAttribute('href')).toBe(
      '/rumble',
    );
    expect(listRumbles).toHaveBeenCalledWith({ status: 'open' });
  });
  it('links to ready demo discs', async () => {
    vi.mocked(getCatchup).mockResolvedValue({ ...view, show: false, nextAction: null });
    vi.mocked(listQuests).mockResolvedValue([]);
    vi.mocked(listRumbles).mockResolvedValue([]);
    vi.mocked(listDemos).mockResolvedValue([
      {
        id: 'main',
        questId: null,
        title: 'WYLD',
        ref: 'main',
        url: '/play/main/',
        kind: 'disc',
        summary: null,
        steps: [],
        seeded: [],
        deepLink: null,
        status: 'ready',
        builtAt: '2026-09-05T12:00:00.000Z',
        error: null,
        hiddenAt: null,
      },
    ]);
    renderScreen();
    expect((await screen.findByRole('link', { name: 'one demo ready' })).getAttribute('href')).toBe(
      '/demos',
    );
  });
});
