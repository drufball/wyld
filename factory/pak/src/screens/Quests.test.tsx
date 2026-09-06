import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider } from '../live/LiveEvents.js';
import { Quests } from './Quests.js';

const quest = {
  id: 'make-map',
  worldId: 'wyld',
  title: 'Make the map',
  pitch: 'Find the wild places.',
  status: 'building',
  progress: 0.4,
  sinceYouLooked: 'The paths now connect.',
  lastNote: 'Trees are growing.',
} as const;
const world = {
  id: 'wyld',
  name: 'WYLD',
  kind: 'game',
  order: 0,
  icon: 'tree',
  questCounts: { idea: 0, planning: 0, building: 1, demo: 0, done: 0, parked: 0 },
};
const note = {
  id: 1,
  questId: quest.id,
  author: 'human',
  text: 'Where next?',
  ts: '2026-09-05T12:00:00.000Z',
};

let liveListener: EventListener | undefined;
const source = () => ({
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'event') liveListener = listener as EventListener;
  },
  removeEventListener() {},
  close() {},
});
const response = (value: unknown, ok = true) =>
  Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(value),
    text: () => Promise.resolve('nope'),
  } as Response);
function renderScreen(fetch: ReturnType<typeof vi.fn>, path = '/quests?world=wyld') {
  vi.stubGlobal('fetch', fetch);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LiveEventsProvider eventSourceFactory={source}>
        <Routes>
          <Route path="/quests" element={<Quests />} />
        </Routes>
      </LiveEventsProvider>
    </MemoryRouter>,
  );
}
function baseFetch(url: string, init?: RequestInit) {
  void init;
  if (url === '/api/worlds') return response([world]);
  if (url === '/api/quests') return response([quest]);
  if (url === '/api/chains?quest=make-map') return response([]);
  return response(quest);
}

afterEach(() => {
  vi.unstubAllGlobals();
  liveListener = undefined;
});

describe('Quests', () => {
  it('shows Try it, Play, and not yet actions according to each quest demo', async () => {
    const discQuest = { ...quest, id: 'disc-quest', title: 'Disc quest' };
    const emptyQuest = { ...quest, id: 'empty-quest', title: 'Empty quest' };
    const demoFields = {
      title: 'Demo',
      ref: 'main',
      url: '/',
      status: 'ready',
      builtAt: null,
      error: null,
      summary: null,
      steps: [],
      seeded: [],
      deepLink: null,
    };
    const demos = [
      { ...demoFields, id: 'z-live', questId: quest.id, kind: 'live' },
      { ...demoFields, id: 'a-disc', questId: discQuest.id, kind: 'disc' },
    ];
    renderScreen(
      vi.fn((url: string) => {
        if (url === '/api/worlds') return response([world]);
        if (url === '/api/quests') return response([quest, discQuest, emptyQuest]);
        if (url === '/api/demos') return response(demos);
        return response([]);
      }),
    );
    expect((await screen.findByRole('link', { name: 'Try it' })).getAttribute('href')).toBe(
      '/demos/z-live',
    );
    expect(screen.getByRole('link', { name: 'Play' }).getAttribute('href')).toBe('/demos/a-disc');
    expect(screen.getByText('not yet')).not.toBeNull();
  });
  it('shows one deep-linked quest and clears the quest parameter', async () => {
    const other = { ...quest, id: 'other', title: 'Other quest' };
    renderScreen(
      vi.fn((url: string) =>
        response(url === '/api/worlds' ? [world] : url === '/api/quests' ? [quest, other] : []),
      ),
      '/quests?world=missing&quest=make-map',
    );

    expect(await screen.findByText(quest.title)).not.toBeNull();
    expect(screen.queryByText(other.title)).toBeNull();
    expect(screen.queryByLabelText('World filter')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show all quests' }));
    expect(await screen.findByLabelText('World filter')).not.toBeNull();
    expect(screen.getByText('No quests match these filters.')).not.toBeNull();
  });

  it('renders world tags and combines world and status filters', async () => {
    const pak = { ...world, id: 'pak', name: 'Expansion Pak', order: 1 };
    const idea = { ...quest, id: 'new-path', title: 'New path', status: 'idea' as const };
    const pakIdea = { ...idea, id: 'pak-idea', worldId: 'pak', title: 'Pak idea' };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/worlds') return response([world, pak]);
      if (url === '/api/quests') return response([quest, idea, pakIdea]);
      return response([]);
    });
    renderScreen(fetch, '/quests');

    expect((await screen.findAllByText('Expansion Pak')).length).toBeGreaterThan(1);
    expect(screen.getAllByText('WYLD').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Ideas' }));
    expect(screen.queryByText(quest.title)).toBeNull();
    expect(screen.getByText(idea.title)).not.toBeNull();
    expect(screen.getByText(pakIdea.title)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expansion Pak' }));
    expect(screen.queryByText(idea.title)).toBeNull();
    expect(screen.getByText(pakIdea.title)).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Expansion Pak' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('shows completed quests expanded when Done is selected', async () => {
    const finished = { ...quest, id: 'finished', title: 'Finished', status: 'done' as const };
    renderScreen(
      vi.fn((url: string, init?: RequestInit) =>
        url === '/api/quests' ? response([quest, finished]) : baseFetch(url, init),
      ),
    );
    expect(await screen.findByRole('button', { name: 'Done (1)' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done', pressed: false }));
    expect(screen.getByText(finished.title)).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Done (1)' })).toBeNull();
  });

  it('renders quest details without private forge references', async () => {
    const { container } = renderScreen(vi.fn(baseFetch));
    expect(await screen.findByText(quest.title)).not.toBeNull();
    expect(screen.getByText(quest.pitch)).not.toBeNull();
    expect(screen.getByText('building')).not.toBeNull();
    expect(screen.getByText(quest.sinceYouLooked)).not.toBeNull();
    expect(screen.getByText(quest.lastNote)).not.toBeNull();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');
    expect(container.textContent).not.toMatch(/#\d+|github\.com|codex\//i);
  });

  it('posts the documented Nudge body', async () => {
    const fetch = vi.fn((url: string, init?: RequestInit) =>
      url.endsWith('/notes') && init?.method === 'POST'
        ? response({ ...note, text: 'Nudge' })
        : baseFetch(url, init),
    );
    renderScreen(fetch);
    fireEvent.click(await screen.findByRole('button', { name: 'Nudge' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/quests/make-map/notes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ author: 'human', text: 'Nudge', intent: 'nudge' }),
        }),
      ),
    );
    expect(screen.getByText("Nudged. Fable's on it.")).not.toBeNull();
  });

  it('does not show a nudge as the latest note', async () => {
    const fetch = vi.fn((url: string, init?: RequestInit) =>
      url === '/api/quests'
        ? response([{ ...quest, sinceYouLooked: '', lastNote: 'nUdGe' }])
        : baseFetch(url, init),
    );
    const { container } = renderScreen(fetch);
    expect(await screen.findByText(quest.title)).not.toBeNull();
    expect(container.querySelector('.quest-context')).toBeNull();
  });

  it('adds an unknown quest in this world when the planner updates it', async () => {
    const newQuest = { ...quest, id: 'raise-bridge', title: 'Raise the bridge' };
    const fetch = vi.fn((url: string, init?: RequestInit) =>
      url === '/api/quests/raise-bridge' ? response(newQuest) : baseFetch(url, init),
    );
    renderScreen(fetch);
    expect(await screen.findByText(quest.title)).not.toBeNull();

    liveListener?.(
      new MessageEvent('event', {
        data: JSON.stringify({
          id: 8,
          ts: '2026-09-05T12:00:00.000Z',
          source: 'planner',
          kind: 'planner.quest_updated',
          questId: newQuest.id,
          payload: {},
        }),
      }),
    );

    expect(await screen.findByText(newQuest.title)).not.toBeNull();
  });

  it('parks and unparks with a human source', async () => {
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/quests/make-map' && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as { status: string };
        return response({ ...quest, status: body.status });
      }
      return baseFetch(url, init);
    });
    renderScreen(fetch);
    fireEvent.click(await screen.findByRole('button', { name: 'Park' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Unpark' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/quests/make-map',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'building', source: 'human' }),
        }),
      ),
    );
  });

  it('moves active quests into the collapsed done section and toggles it', async () => {
    const finishedQuest = { ...quest, id: 'plant-trees', title: 'Plant the trees', status: 'done' };
    const parkedQuest = { ...quest, id: 'dig-cave', title: 'Dig a cave', status: 'parked' };
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/quests') return response([quest, parkedQuest, finishedQuest]);
      if (url === '/api/quests/make-map' && init?.method === 'PATCH') {
        return response({ ...quest, status: 'done' });
      }
      return baseFetch(url, init);
    });
    renderScreen(fetch);

    expect(await screen.findByText(quest.title)).not.toBeNull();
    expect(screen.queryByText(finishedQuest.title)).toBeNull();
    expect(document.querySelectorAll('.quest-actions button')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Done (1)' }).getAttribute('aria-expanded')).toBe(
      'false',
    );

    fireEvent.click(
      document.querySelector<HTMLButtonElement>('.quest-actions button:nth-child(3)')!,
    );
    await waitFor(() => expect(screen.queryByText(quest.title)).toBeNull());
    expect(fetch).toHaveBeenCalledWith(
      '/api/quests/make-map',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'done', source: 'human' }),
      }),
    );

    const toggle = screen.getByRole('button', { name: 'Done (2)' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(quest.title)).not.toBeNull();
    expect(screen.getByText(finishedQuest.title)).not.toBeNull();
    expect(
      Array.from(document.querySelectorAll('.quest-actions button')).some(
        (button) => button.textContent === 'Done',
      ),
    ).toBe(false);
  });

  it('starts a quest-targeted chain and renders it without old note history', async () => {
    const chain = {
      id: 8,
      status: 'open',
      createdAt: note.ts,
      lastActivityAt: note.ts,
      questId: quest.id,
      messages: [{ id: 9, chainId: 8, author: 'human', text: 'Where next?', ts: note.ts }],
    };
    const fetch = vi.fn((url: string, init?: RequestInit) =>
      url === '/api/chains' && init?.method === 'POST' ? response(chain) : baseFetch(url, init),
    );
    renderScreen(fetch);
    const ask = await screen.findByRole('button', { name: 'Ask' });
    expect(ask.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(ask);
    expect(ask.getAttribute('aria-expanded')).toBe('true');
    const field = screen.getByLabelText('Ask about this quest');
    fireEvent.change(field, { target: { value: 'Where next?' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/chains',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'Where next?', questId: quest.id }),
        }),
      ),
    );
    expect(await screen.findByText('Where next?')).not.toBeNull();
    expect(screen.queryByLabelText('Ask about this quest')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make this a quest' })).toBeNull();
    expect(fetch.mock.calls.some(([url, init]) => url.endsWith('/notes') && !init?.method)).toBe(
      false,
    );
  });

  it('shows an existing open chain without its redundant quest chip', async () => {
    const chain = {
      id: 8,
      status: 'open',
      createdAt: note.ts,
      lastActivityAt: note.ts,
      questId: quest.id,
      messages: [{ id: 9, chainId: 8, author: 'human', text: 'Open question', ts: note.ts }],
    };
    renderScreen(
      vi.fn((url: string, init?: RequestInit) =>
        url === '/api/chains?quest=make-map' ? response([chain]) : baseFetch(url, init),
      ),
    );
    const card = (await screen.findByText('Open question')).closest('.quest-card')!;
    expect(card.querySelector('.chain-card .world-tag')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make this a quest' })).toBeNull();
  });

  it('keeps a newline and does not submit an Ask on Shift+Enter', async () => {
    const fetch = vi.fn(baseFetch);
    renderScreen(fetch);
    fireEvent.click(await screen.findByRole('button', { name: 'Ask' }));
    const field = screen.getByLabelText('Ask about this quest');
    fireEvent.change(field, { target: { value: 'first line' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    fireEvent.change(field, { target: { value: 'first line\nsecond line' } });

    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    expect((field as HTMLTextAreaElement).value).toBe('first line\nsecond line');
  });
});
