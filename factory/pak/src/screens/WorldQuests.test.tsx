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

  it('posts an Ask and renders a planner note arriving live', async () => {
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
    fireEvent.change(field, { target: { value: 'Where next?' } });
    fireEvent.submit(field.closest('form')!);
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
});
