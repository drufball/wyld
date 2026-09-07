import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider } from '../live/LiveEvents.js';
import { Explain, Roadmap } from './Explain.js';

const mocks = vi.hoisted(() => ({ getArtifact: vi.fn() }));
vi.mock('../api/client.js', () => ({ getArtifact: mocks.getArtifact }));

let liveListener: EventListener | undefined;
const source = () => ({
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'event') liveListener = listener as EventListener;
  },
  removeEventListener() {},
  close() {},
});
const artifact = {
  slug: 'forest-map',
  questId: 'demo-quest',
  title: 'Forest map',
  summary: 'How paths join.',
  version: 3,
  createdAt: '2026-09-07T10:00:00.000Z',
  updatedAt: '2026-09-07T10:00:00.000Z',
  html: '<html><body>SECRET ARTIFACT MARKUP</body></html>',
};

function renderRoute(path: string, roadmap = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LiveEventsProvider eventSourceFactory={source}>
        {roadmap ? (
          <Roadmap />
        ) : (
          <Routes>
            <Route path="/explain/:slug" element={<Explain />} />
          </Routes>
        )}
      </LiveEventsProvider>
    </MemoryRouter>,
  );
}

function publish(slug: string) {
  liveListener?.(
    new MessageEvent('event', {
      data: JSON.stringify({
        id: 1,
        ts: '2026-09-07T10:00:00.000Z',
        source: 'planner',
        kind: 'planner.artifact_published',
        payload: { slug, title: 'Updated', questId: null, version: 4 },
      }),
    }),
  );
}

afterEach(() => {
  vi.clearAllMocks();
  liveListener = undefined;
});

describe('Explain', () => {
  it('loads metadata into a safe iframe without inserting artifact HTML', async () => {
    mocks.getArtifact.mockResolvedValue(artifact);
    renderRoute('/explain/forest-map');
    expect(await screen.findByRole('heading', { name: artifact.title })).not.toBeNull();
    expect(screen.getByText(artifact.summary)).not.toBeNull();
    expect(screen.getByText('v3')).not.toBeNull();
    const frames = document.querySelectorAll('iframe');
    expect(frames).toHaveLength(1);
    const frame = frames[0]!;
    expect(frame.getAttribute('src')).toBe('/artifacts/forest-map/?v=3');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame.getAttribute('title')).toBe(artifact.title);
    expect(frame.hasAttribute('srcdoc')).toBe(false);
    expect(document.body.innerHTML).not.toContain('SECRET ARTIFACT MARKUP');
  });

  it('always escapes the iframe slug', async () => {
    mocks.getArtifact.mockResolvedValue({ ...artifact, slug: 'a b' });
    renderRoute('/explain/a%20b');
    expect((await screen.findByTitle(artifact.title)).getAttribute('src')).toBe(
      '/artifacts/a%20b/?v=3',
    );
  });

  it('shows the explainer miss state', async () => {
    mocks.getArtifact.mockRejectedValue(new Error('missing'));
    renderRoute('/explain/missing');
    expect(await screen.findByText("That explainer isn't here yet.")).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Back to quests' }).getAttribute('href')).toBe(
      '/quests',
    );
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('shows roadmap miss and hit states', async () => {
    mocks.getArtifact.mockRejectedValueOnce(new Error('missing'));
    const view = renderRoute('/roadmap', true);
    expect(
      await screen.findByText(
        "The roadmap explainer isn't written yet — it arrives with the next piece.",
      ),
    ).not.toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    view.unmount();
    mocks.getArtifact.mockResolvedValue({
      ...artifact,
      slug: 'roadmap',
      questId: null,
      version: 1,
    });
    renderRoute('/roadmap', true);
    expect((await screen.findByTitle(artifact.title)).getAttribute('src')).toBe(
      '/artifacts/roadmap/?v=1',
    );
  });

  it('reloads only when its artifact is published', async () => {
    mocks.getArtifact
      .mockResolvedValueOnce(artifact)
      .mockResolvedValueOnce({ ...artifact, version: 4 });
    renderRoute('/explain/forest-map');
    await screen.findByTitle(artifact.title);
    publish('other');
    expect(mocks.getArtifact).toHaveBeenCalledTimes(1);
    publish('forest-map');
    await waitFor(() =>
      expect(screen.getByTitle(artifact.title).getAttribute('src')).toBe(
        '/artifacts/forest-map/?v=4',
      ),
    );
    expect(mocks.getArtifact).toHaveBeenCalledTimes(2);
  });

  it('links back to its quest or the quest list', async () => {
    mocks.getArtifact.mockResolvedValueOnce(artifact);
    const view = renderRoute('/explain/forest-map');
    expect((await screen.findByRole('link', { name: 'Back' })).getAttribute('href')).toBe(
      '/quests?quest=demo-quest',
    );
    view.unmount();
    mocks.getArtifact.mockResolvedValueOnce({ ...artifact, questId: null });
    renderRoute('/explain/forest-map');
    expect((await screen.findByRole('link', { name: 'Back' })).getAttribute('href')).toBe(
      '/quests',
    );
  });
});
