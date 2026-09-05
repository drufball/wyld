import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider } from '../live/LiveEvents.js';
import { WorldQuests } from './WorldQuests.js';

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
function renderScreen(fetch: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetch);
  return render(
    <MemoryRouter initialEntries={['/worlds/wyld']}>
      <LiveEventsProvider eventSourceFactory={source}>
        <Routes>
          <Route path="/worlds/:id" element={<WorldQuests />} />
        </Routes>
      </LiveEventsProvider>
    </MemoryRouter>,
  );
}
function baseFetch(url: string, init?: RequestInit) {
  if (url === '/api/worlds') return response([world]);
  if (url === '/api/quests?world=wyld') return response([quest]);
  if (url.endsWith('/notes') && init?.method !== 'POST') return response([note]);
  return response(quest);
}

afterEach(() => {
  vi.unstubAllGlobals();
  liveListener = undefined;
});

describe('World quests', () => {
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
      url === '/api/quests?world=wyld'
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
      if (url === '/api/quests?world=wyld') return response([quest, parkedQuest, finishedQuest]);
      if (url === '/api/quests/make-map' && init?.method === 'PATCH') {
        return response({ ...quest, status: 'done' });
      }
      return baseFetch(url, init);
    });
    renderScreen(fetch);

    expect(await screen.findByText(quest.title)).not.toBeNull();
    expect(screen.queryByText(finishedQuest.title)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Done' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Done (1)' }).getAttribute('aria-expanded')).toBe(
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
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
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });

  it('posts an Ask from the textarea on Enter and renders a planner note arriving live', async () => {
    let notes = [note];
    const plannerNote = { ...note, id: 2, author: 'planner', text: 'Follow the lanterns.' };
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/notes') && init?.method === 'POST') return response(note);
      if (url.endsWith('/notes')) return response(notes);
      return baseFetch(url, init);
    });
    renderScreen(fetch);
    fireEvent.click(await screen.findByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Where next?')).not.toBeNull();
    const field = screen.getByLabelText('Ask about this quest');
    expect(field.tagName).toBe('TEXTAREA');
    expect(field.id).toBe(`ask-${quest.id}`);
    fireEvent.change(field, { target: { value: 'Where next?' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/quests/make-map/notes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ author: 'human', text: 'Where next?', intent: 'ask' }),
        }),
      ),
    );
    notes = [note, plannerNote];
    liveListener?.(
      new MessageEvent('event', {
        data: JSON.stringify({
          id: 7,
          ts: '2026-09-05T12:00:00.000Z',
          source: 'planner',
          kind: 'planner.note',
          questId: quest.id,
          payload: { text: plannerNote.text },
        }),
      }),
    );
    expect(await screen.findByText(plannerNote.text)).not.toBeNull();
    expect(screen.getByText('Fable')).not.toBeNull();
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

  it('grows for long text and still submits it on Enter', async () => {
    const longText = 'How should the winding trail through the ancient forest reach the mountain?';
    const fetch = vi.fn((url: string, init?: RequestInit) =>
      url.endsWith('/notes') && init?.method === 'POST' ? response(note) : baseFetch(url, init),
    );
    renderScreen(fetch);
    fireEvent.click(await screen.findByRole('button', { name: 'Ask' }));
    const field = screen.getByLabelText('Ask about this quest') as HTMLTextAreaElement;
    Object.defineProperty(field, 'scrollHeight', { configurable: true, value: 88 });
    fireEvent.change(field, { target: { value: longText } });

    expect(field.style.height).toBe('88px');
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/quests/make-map/notes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ author: 'human', text: longText, intent: 'ask' }),
        }),
      ),
    );
  });
});
