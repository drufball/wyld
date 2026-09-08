import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveEventsProvider } from '../live/LiveEvents.js';
import { Explain, Roadmap } from './Explain.js';

const mocks = vi.hoisted(() => ({ getArtifact: vi.fn(), listChains: vi.fn(), postChain: vi.fn() }));
vi.mock('../api/client.js', () => ({
  getArtifact: mocks.getArtifact,
  listChains: mocks.listChains,
  postChain: mocks.postChain,
}));

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
  act(() => {
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
  });
}

async function fromFrame(
  contentWindow: Window,
  data: Record<string, unknown>,
  consumed: () => void,
) {
  await waitFor(() => {
    window.dispatchEvent(new MessageEvent('message', { source: contentWindow, data }));
    consumed();
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  liveListener = undefined;
});

mocks.listChains.mockResolvedValue([]);

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

  it('remeasures when either the page body or viewer parent resizes', async () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe;
        disconnect = disconnect;
      },
    );
    mocks.getArtifact.mockResolvedValue(artifact);

    const view = renderRoute('/explain/forest-map');
    await screen.findByTitle(artifact.title);
    const section = view.container.querySelector('section');

    expect(section?.parentElement).not.toBe(document.body);
    expect(observe).toHaveBeenCalledWith(document.body);
    expect(observe).toHaveBeenCalledWith(section?.parentElement);
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
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

  it('keeps pinning disabled until the frame is ready and toggles pin mode', async () => {
    mocks.getArtifact.mockResolvedValue(artifact);
    renderRoute('/explain/forest-map');
    const button = await screen.findByRole('button', { name: 'Pin a comment' });
    const frame = screen.getByTitle(artifact.title) as HTMLIFrameElement;
    const postMessage = vi.fn();
    const contentWindow = { postMessage } as unknown as Window;
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: contentWindow });

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('title')).toBe("This explainer can't take pins yet");
    fireEvent.click(button);
    expect(postMessage).not.toHaveBeenCalledWith({ type: 'wyld:pin:mode', on: true }, '*');

    await fromFrame(contentWindow, { type: 'wyld:pin:ready' }, () =>
      expect(button.hasAttribute('aria-disabled')).toBe(false),
    );
    expect(button.getAttribute('title')).toBe('Pin a comment');
    await waitFor(() =>
      expect(postMessage).toHaveBeenLastCalledWith({ type: 'wyld:pin:locate', elements: [] }, '*'),
    );

    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'wyld:pin:mode', on: true }, '*');
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'wyld:pin:mode', on: false }, '*');
  });

  it('enters pin mode while the modifier is held and leaves on release', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mac' });
    mocks.getArtifact.mockResolvedValue(artifact);
    renderRoute('/explain/forest-map');
    const frame = (await screen.findByTitle(artifact.title)) as HTMLIFrameElement;
    const postMessage = vi.fn();
    const contentWindow = { postMessage } as unknown as Window;
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: contentWindow });
    await fromFrame(contentWindow, { type: 'wyld:pin:ready' }, () =>
      expect(
        screen.getByRole('button', { name: 'Pin a comment' }).getAttribute('aria-disabled'),
      ).toBeNull(),
    );

    await waitFor(() => {
      fireEvent.keyDown(window, { key: 'Meta', metaKey: true });
      expect(postMessage).toHaveBeenCalledWith({ type: 'wyld:pin:mode', on: true }, '*');
    });
    fireEvent.keyUp(window, { key: 'Meta', metaKey: false });
    await waitFor(() =>
      expect(postMessage).toHaveBeenLastCalledWith({ type: 'wyld:pin:mode', on: false }, '*'),
    );
  });

  it('releases a held pin mode when the window blurs', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mac' });
    mocks.getArtifact.mockResolvedValue(artifact);
    renderRoute('/explain/forest-map');
    const frame = (await screen.findByTitle(artifact.title)) as HTMLIFrameElement;
    const postMessage = vi.fn();
    const contentWindow = { postMessage } as unknown as Window;
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: contentWindow });
    await fromFrame(contentWindow, { type: 'wyld:pin:ready' }, () =>
      expect(
        screen.getByRole('button', { name: 'Pin a comment' }).getAttribute('aria-disabled'),
      ).toBeNull(),
    );
    await waitFor(() => {
      fireEvent.keyDown(window, { metaKey: true });
      expect(postMessage).toHaveBeenCalledWith({ type: 'wyld:pin:mode', on: true }, '*');
    });
    fireEvent.blur(window);
    await waitFor(() =>
      expect(postMessage).toHaveBeenLastCalledWith({ type: 'wyld:pin:mode', on: false }, '*'),
    );
  });

  it('enters pin mode when the frame reports the modifier held', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mac' });
    mocks.getArtifact.mockResolvedValue(artifact);
    renderRoute('/explain/forest-map');
    const frame = (await screen.findByTitle(artifact.title)) as HTMLIFrameElement;
    const postMessage = vi.fn();
    const contentWindow = { postMessage } as unknown as Window;
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: contentWindow });
    await fromFrame(contentWindow, { type: 'wyld:pin:ready' }, () =>
      expect(
        screen.getByRole('button', { name: 'Pin a comment' }).getAttribute('aria-disabled'),
      ).toBeNull(),
    );
    await fromFrame(contentWindow, { type: 'wyld:pin:key', held: true }, () =>
      expect(postMessage).toHaveBeenCalledWith({ type: 'wyld:pin:mode', on: true }, '*'),
    );
  });

  it('keeps the Pin button working while the modifier is held', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mac' });
    mocks.getArtifact.mockResolvedValue(artifact);
    renderRoute('/explain/forest-map');
    const button = await screen.findByRole('button', { name: 'Pin a comment' });
    const frame = screen.getByTitle(artifact.title) as HTMLIFrameElement;
    const postMessage = vi.fn();
    const contentWindow = { postMessage } as unknown as Window;
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: contentWindow });
    await fromFrame(contentWindow, { type: 'wyld:pin:ready' }, () =>
      expect(button.getAttribute('aria-disabled')).toBeNull(),
    );
    await waitFor(() => {
      fireEvent.keyDown(window, { metaKey: true });
      expect(button.getAttribute('aria-pressed')).toBe('true');
    });
    fireEvent.click(button);
    await waitFor(() =>
      expect(postMessage).toHaveBeenLastCalledWith({ type: 'wyld:pin:mode', on: false }, '*'),
    );
    const calls = postMessage.mock.calls.length;
    fireEvent.keyUp(window, { metaKey: false });
    expect(postMessage).toHaveBeenCalledTimes(calls);
  });

  it('recovers frame readiness by asking again with hello', async () => {
    mocks.getArtifact.mockResolvedValue(artifact);
    renderRoute('/explain/forest-map');
    const button = await screen.findByRole('button', { name: 'Pin a comment' });
    const frame = screen.getByTitle(artifact.title) as HTMLIFrameElement;
    let hellos = 0;
    const contentWindow = {
      postMessage(message: unknown) {
        if (
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'wyld:pin:hello'
        )
          hellos += 1;
      },
    } as unknown as Window;
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: contentWindow });

    expect(button.getAttribute('aria-disabled')).toBe('true');

    // The bridge is created by a passive effect that may not have run yet, and an unheard `load`
    // is dropped forever — so re-fire it until the bridge answers through the stub.
    await waitFor(() => {
      fireEvent.load(frame);
      expect(hellos).toBeGreaterThan(0);
    });

    // The load listener is now proven registered, so one more load must re-ask, synchronously.
    const before = hellos;
    fireEvent.load(frame);
    expect(hellos).toBe(before + 1);

    await fromFrame(contentWindow, { type: 'wyld:pin:ready' }, () =>
      expect(button.hasAttribute('aria-disabled')).toBe(false),
    );
  });

  it('creates an anchored chain from a frame pick and exits pin mode', async () => {
    const created = {
      id: 3,
      kind: 'question',
      status: 'open',
      createdAt: '2026-09-07T12:00:00.000Z',
      lastActivityAt: '2026-09-07T12:00:00.000Z',
      questId: null,
      snoozedUntil: null,
      pinnedAt: null,
      tags: [],
      demoId: null,
      payload: null,
      rumble: null,
      anchor: { artifact: 'forest-map', element: 'hero', label: 'Hero title' },
      messages: [],
    } as const;
    mocks.getArtifact.mockResolvedValue(artifact);
    mocks.postChain.mockResolvedValue(created);
    renderRoute('/explain/forest-map');
    const frame = (await screen.findByTitle(artifact.title)) as HTMLIFrameElement;
    const postMessage = vi.fn();
    const contentWindow = { postMessage } as unknown as Window;
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: contentWindow });
    await fromFrame(
      contentWindow,
      {
        type: 'wyld:pin:pick',
        element: 'hero',
        label: 'Hero title',
        rect: { x: 10, y: 20, w: 30, h: 40 },
      },
      () => expect(screen.queryByText('Pinned to: Hero title')).not.toBeNull(),
    );

    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Why this hero?' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() =>
      expect(mocks.postChain).toHaveBeenCalledWith('Why this hero?', undefined, {
        artifact: 'forest-map',
        element: 'hero',
        label: 'Hero title',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(postMessage).toHaveBeenCalledWith({ type: 'wyld:pin:mode', on: false }, '*');
  });

  it('attaches the demo capture to a pinned comment', async () => {
    mocks.getArtifact.mockResolvedValue(artifact);
    mocks.postChain.mockResolvedValue({
      id: 4,
      kind: 'question',
      status: 'open',
      createdAt: '2026-09-07T12:00:00.000Z',
      lastActivityAt: '2026-09-07T12:00:00.000Z',
      questId: null,
      snoozedUntil: null,
      tags: [],
      demoId: null,
      payload: null,
      rumble: null,
      anchor: { artifact: 'forest-map', element: 'demo', label: 'Demo' },
      messages: [],
    });
    renderRoute('/explain/forest-map');
    const frame = (await screen.findByTitle(artifact.title)) as HTMLIFrameElement;
    const postMessage = vi.fn();
    const contentWindow = { postMessage } as unknown as Window;
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: contentWindow });
    await fromFrame(contentWindow, { type: 'wyld:pin:ready' }, () =>
      expect(
        screen.getByRole('button', { name: 'Pin a comment' }).hasAttribute('aria-disabled'),
      ).toBe(false),
    );
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: contentWindow,
          data: {
            type: 'wyld:pin:pick',
            element: 'demo',
            label: 'Demo',
            rect: { x: 10, y: 20, w: 30, h: 40 },
          },
        }),
      );
    });
    expect(screen.queryByText('Pinned to: Demo')).not.toBeNull();
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        { type: 'wyld:pin:capture', id: 1, element: 'demo' },
        '*',
      ),
    );
    const capture = { screenshot: 'data:image/png;base64,YQ==', state: { day: 3 } };
    await fromFrame(contentWindow, { type: 'wyld:pin:capture:result', id: 1, capture }, () =>
      expect(screen.queryByText('Attached: what the demo looked like')).not.toBeNull(),
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Remember this' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(mocks.postChain).toHaveBeenCalledWith(
        'Remember this',
        undefined,
        { artifact: 'forest-map', element: 'demo', label: 'Demo' },
        capture,
      ),
    );
  });

  it('shows what the demo looked like on a pin that has a capture', async () => {
    mocks.getArtifact.mockResolvedValue(artifact);
    mocks.listChains.mockResolvedValue([
      {
        id: 8,
        kind: 'question',
        status: 'open',
        createdAt: '2026-09-07T12:00:00.000Z',
        lastActivityAt: '2026-09-07T12:00:00.000Z',
        questId: null,
        snoozedUntil: null,
        tags: [],
        demoId: null,
        payload: {
          capture: { screenshot: '/api/chains/8/screenshot', state: { day: 3, phase: 'night' } },
        },
        rumble: null,
        anchor: { artifact: 'forest-map', element: 'demo', label: 'Demo' },
        messages: [
          {
            id: 1,
            chainId: 8,
            author: 'human',
            text: 'Remember this',
            ts: '2026-09-07T12:00:00.000Z',
          },
        ],
      },
    ]);
    renderRoute('/explain/forest-map');
    const frame = (await screen.findByTitle(artifact.title)) as HTMLIFrameElement;
    const contentWindow = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: contentWindow });
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 500,
      height: 500,
      top: 0,
      right: 500,
      bottom: 500,
      left: 0,
      toJSON: () => ({}),
    });
    await fromFrame(contentWindow, { type: 'wyld:pin:ready' }, () =>
      expect(
        screen.getByRole('button', { name: 'Pin a comment' }).hasAttribute('aria-disabled'),
      ).toBe(false),
    );
    await waitFor(() =>
      expect(contentWindow.postMessage).toHaveBeenCalledWith(
        { type: 'wyld:pin:locate', elements: ['demo'] },
        '*',
      ),
    );
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: contentWindow,
          data: {
            type: 'wyld:pin:rects',
            rects: { demo: { x: 10, y: 20, w: 30, h: 40 } },
          },
        }),
      );
    });
    expect(await screen.findByRole('button', { name: 'Pinned comment 1: Demo' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pinned comment 1: Demo' }));
    const image = await screen.findByRole('img', { name: 'What the demo looked like' });
    expect(image.getAttribute('src')).toBe('/api/chains/8/screenshot');
    expect(screen.getByText('Day 3 · night · —')).not.toBeNull();
  });

  it('closes the pin composer on Escape without changing frame pin mode', async () => {
    mocks.getArtifact.mockResolvedValue(artifact);
    renderRoute('/explain/forest-map');
    const frame = (await screen.findByTitle(artifact.title)) as HTMLIFrameElement;
    const postMessage = vi.fn();
    const contentWindow = { postMessage } as unknown as Window;
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: contentWindow });
    await fromFrame(
      contentWindow,
      {
        type: 'wyld:pin:pick',
        element: 'hero',
        label: 'Hero title',
        rect: { x: 10, y: 20, w: 30, h: 40 },
      },
      () => expect(screen.queryByRole('dialog')).not.toBeNull(),
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox')));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(postMessage).not.toHaveBeenCalledWith({ type: 'wyld:pin:mode', on: false }, '*');
  });

  it('numbers and positions visible anchored chains in creation order and opens a marker', async () => {
    const chain = (id: number, element: string, label: string, createdAt: string) => ({
      id,
      kind: 'question' as const,
      status: 'open' as const,
      createdAt,
      lastActivityAt: createdAt,
      questId: null,
      snoozedUntil: null,
      pinnedAt: null,
      tags: [],
      demoId: null,
      payload: null,
      rumble: null,
      anchor: { artifact: 'forest-map', element, label },
      messages: [
        { id, chainId: id, author: 'human' as const, text: `${label} message`, ts: createdAt },
      ],
    });
    mocks.getArtifact.mockResolvedValue(artifact);
    mocks.listChains.mockResolvedValue([
      chain(2, 'hero', 'Details', '2026-09-07T12:00:00.000Z'),
      chain(1, 'hero', 'Hero title', '2026-09-07T11:00:00.000Z'),
      chain(3, 'missing', 'Missing', '2026-09-07T13:00:00.000Z'),
    ]);
    renderRoute('/explain/forest-map');
    const frame = (await screen.findByTitle(artifact.title)) as HTMLIFrameElement;
    const contentWindow = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: contentWindow });
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 500,
      height: 500,
      top: 0,
      right: 500,
      bottom: 500,
      left: 0,
      toJSON: () => ({}),
    });
    await fromFrame(contentWindow, { type: 'wyld:pin:ready' }, () =>
      expect(
        screen.getByRole('button', { name: 'Pin a comment' }).hasAttribute('aria-disabled'),
      ).toBe(false),
    );
    await fromFrame(
      contentWindow,
      {
        type: 'wyld:pin:rects',
        rects: {
          hero: { x: 100, y: 20, w: 30, h: 40 },
        },
      },
      () =>
        expect(
          screen.queryByRole('button', { name: 'Pinned comment 1: Hero title' }),
        ).not.toBeNull(),
    );

    const first = screen.getByRole('button', { name: 'Pinned comment 1: Hero title' });
    const second = screen.getByRole('button', { name: 'Pinned comment 2: Details' });
    expect(first.style.left).toBe('130px');
    expect(first.style.top).toBe('20px');
    expect(second.style.left).toBe('86px');
    expect(second.style.top).toBe('20px');
    expect(screen.queryByRole('button', { name: 'Pinned comment 3: Missing' })).toBeNull();

    fireEvent.click(first);
    expect(await screen.findByText('Hero title message')).not.toBeNull();
  });
});
