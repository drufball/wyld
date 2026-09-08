import { externalReference } from '@wyld/shared';
import { describe, expect, it, vi } from 'vitest';
import { createPinBridge, PIN_BRIDGE_SNIPPET, PIN_BRIDGE_SOURCE } from './pin-bridge.js';

describe('pin bridge', () => {
  const captureHarness = () => {
    const target = new EventTarget();
    const contentWindow = { postMessage: vi.fn() } as unknown as Window;
    const timers = new Map<unknown, () => void>();
    const setTimer = vi.fn((fn: () => void) => {
      const id = Symbol('timer');
      timers.set(id, fn);
      return id;
    });
    const clearTimer = vi.fn((id: unknown) => timers.delete(id));
    const bridge = createPinBridge({
      frame: { contentWindow },
      target: target as unknown as Window,
      onReady: vi.fn(),
      onKeyHold: vi.fn(),
      onPick: vi.fn(),
      onRects: vi.fn(),
      setTimer,
      clearTimer,
    });
    const result = (id: number, capture: unknown) =>
      target.dispatchEvent(
        new MessageEvent('message', {
          source: contentWindow,
          data: { type: 'wyld:pin:capture:result', id, capture },
        }),
      );
    return { bridge, contentWindow, timers, setTimer, clearTimer, result };
  };

  it('asks the embed for a capture and resolves it', async () => {
    const harness = captureHarness();
    const capture = harness.bridge.capture('hero');
    expect(harness.contentWindow.postMessage).toHaveBeenLastCalledWith(
      { type: 'wyld:pin:capture', id: 1, element: 'hero' },
      '*',
    );
    harness.result(1, { screenshot: 'data:image/png;base64,YQ==', state: { level: 2 } });
    await expect(capture).resolves.toEqual({
      screenshot: 'data:image/png;base64,YQ==',
      state: { level: 2 },
    });
    expect(harness.clearTimer).toHaveBeenCalledOnce();
  });

  it('resolves null when the explainer reports no embed', async () => {
    const harness = captureHarness();
    const capture = harness.bridge.capture('missing');
    harness.result(1, null);
    await expect(capture).resolves.toBeNull();
  });

  it('resolves null when the capture times out', async () => {
    const harness = captureHarness();
    const capture = harness.bridge.capture('hero');
    expect(harness.setTimer).toHaveBeenCalledWith(expect.any(Function), 3000);
    [...harness.timers.values()][0]!();
    await expect(capture).resolves.toBeNull();
  });

  it('rejects a screenshot that is not a data url', async () => {
    const harness = captureHarness();
    const capture = harness.bridge.capture('hero');
    harness.result(1, { screenshot: 'https://example.test/image.png', state: { level: 2 } });
    await expect(capture).resolves.toEqual({ screenshot: null, state: { level: 2 } });
  });

  it('ignores a capture result for an unknown id', async () => {
    const harness = captureHarness();
    const capture = harness.bridge.capture('hero');
    harness.result(99, { screenshot: 'data:image/png;base64,YQ==', state: null });
    expect(harness.clearTimer).not.toHaveBeenCalled();
    [...harness.timers.values()][0]!();
    await expect(capture).resolves.toBeNull();
  });

  it('relays a capture request to the embed and the result back', () => {
    document.body.innerHTML = '<div data-pin="hero"><iframe data-wyld-demo></iframe></div>';
    const embed = document.querySelector('iframe')!;
    const embedWindow = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(embed, 'contentWindow', { configurable: true, value: embedWindow });
    const parentWindow = { postMessage: vi.fn() } as unknown as Window;
    const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');
    Object.defineProperty(window, 'parent', { configurable: true, value: parentWindow });
    try {
      new Function(PIN_BRIDGE_SOURCE)();
      window.dispatchEvent(
        new MessageEvent('message', {
          source: parentWindow,
          data: { type: 'wyld:pin:capture', id: 7, element: 'hero' },
        }),
      );
      expect(embedWindow.postMessage).toHaveBeenCalledWith(
        { type: 'wyld:demo:capture', id: 7 },
        '*',
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          source: embedWindow,
          data: { type: 'wyld:demo:capture:result', id: 7, screenshot: 'shot', state: 'state' },
        }),
      );
      expect(parentWindow.postMessage).toHaveBeenCalledWith(
        {
          type: 'wyld:pin:capture:result',
          id: 7,
          capture: { screenshot: 'shot', state: 'state' },
        },
        '*',
      );
    } finally {
      if (originalParent) Object.defineProperty(window, 'parent', originalParent);
      document.body.innerHTML = '';
    }
  });

  it('styles landscape and portrait embeds', () => {
    expect(PIN_BRIDGE_SOURCE).toContain('aspect-ratio:16/9');
    expect(PIN_BRIDGE_SOURCE).toContain('aspect-ratio:9/16');
  });

  it('lets pin mode click through an embed', () => {
    expect(PIN_BRIDGE_SOURCE).toContain(
      '.wyld-pin-mode iframe[data-wyld-demo]{pointer-events:none}',
    );
  });

  it('ships a self-contained valid snippet', () => {
    expect(() => new Function(PIN_BRIDGE_SOURCE)).not.toThrow();
    expect(PIN_BRIDGE_SNIPPET.startsWith('<script>')).toBe(true);
    expect(PIN_BRIDGE_SNIPPET.endsWith('</script>')).toBe(true);
    expect(externalReference(PIN_BRIDGE_SNIPPET)).toBeNull();
  });

  it('validates messages, posts commands, and stops', () => {
    const listeners = new Set<EventListener>();
    const target = {
      addEventListener: (_: string, fn: EventListener) => listeners.add(fn),
      removeEventListener: (_: string, fn: EventListener) => listeners.delete(fn),
    } as unknown as Window;
    const contentWindow = { postMessage: vi.fn() } as unknown as Window;
    const frame = { contentWindow };
    const onReady = vi.fn();
    const onPick = vi.fn();
    const onRects = vi.fn();
    const bridge = createPinBridge({ frame, target, onReady, onKeyHold: vi.fn(), onPick, onRects });
    expect(contentWindow.postMessage).toHaveBeenNthCalledWith(1, { type: 'wyld:pin:hello' }, '*');
    const send = (data: unknown, source: MessageEventSource = contentWindow) =>
      listeners.forEach((fn) => fn(new MessageEvent('message', { data, source })));
    send({ type: 'wyld:pin:ready' }, {} as Window);
    send({ type: 'wyld:pin:ready' });
    expect(onReady).toHaveBeenCalledOnce();
    send({
      type: 'wyld:pin:pick',
      element: 'hero',
      label: 'Hero',
      rect: { x: 1, y: 2, w: 3, h: 4 },
    });
    send({ type: 'wyld:pin:pick', element: 'hero', label: ' ', rect: { x: 1, y: 2, w: 3, h: 4 } });
    send({
      type: 'wyld:pin:pick',
      element: 'hero',
      label: 'Hero',
      rect: { x: 'bad', y: 2, w: 3, h: 4 },
    });
    expect(onPick).toHaveBeenCalledOnce();
    send({
      type: 'wyld:pin:rects',
      rects: { good: { x: 1, y: 2, w: 3, h: 4 }, bad: { x: NaN, y: 2, w: 3, h: 4 } },
    });
    expect(onRects).toHaveBeenCalledWith({ good: { x: 1, y: 2, w: 3, h: 4 } });
    send({ type: 'other' });
    send('wyld:pin:ready');
    bridge.setMode(true);
    bridge.locate(['hero']);
    expect(contentWindow.postMessage).toHaveBeenNthCalledWith(
      2,
      { type: 'wyld:pin:mode', on: true },
      '*',
    );
    expect(contentWindow.postMessage).toHaveBeenNthCalledWith(
      3,
      { type: 'wyld:pin:locate', elements: ['hero'] },
      '*',
    );
    bridge.stop();
    expect(listeners.size).toBe(0);
  });

  it('reports a held modifier from the frame and validates it', () => {
    const target = new EventTarget();
    const contentWindow = { postMessage: vi.fn() } as unknown as Window;
    const onKeyHold = vi.fn();
    const bridge = createPinBridge({
      frame: { contentWindow },
      target: target as unknown as Window,
      onReady: vi.fn(),
      onKeyHold,
      onPick: vi.fn(),
      onRects: vi.fn(),
    });
    const send = (held: unknown, source: MessageEventSource = contentWindow) =>
      target.dispatchEvent(
        new MessageEvent('message', {
          source,
          data: { type: 'wyld:pin:key', held },
        }),
      );

    send(true);
    send('true');
    send(false, {} as Window);

    expect(onKeyHold).toHaveBeenCalledOnce();
    expect(onKeyHold).toHaveBeenCalledWith(true);
    bridge.stop();
  });

  it('recovers a ready announcement that happened before the listener existed', () => {
    const target = new EventTarget();
    const onReady = vi.fn();
    const contentWindow = {
      postMessage(message: unknown) {
        if (JSON.stringify(message) === JSON.stringify({ type: 'wyld:pin:hello' }))
          target.dispatchEvent(
            new MessageEvent('message', {
              data: { type: 'wyld:pin:ready' },
              source: contentWindow as unknown as Window,
            }),
          );
      },
    } as unknown as Window;

    const bridge = createPinBridge({
      frame: { contentWindow },
      target: target as unknown as Window,
      onReady,
      onKeyHold: vi.fn(),
      onPick: vi.fn(),
      onRects: vi.fn(),
    });

    expect(onReady).toHaveBeenCalledOnce();
    bridge.stop();
  });

  it('posts hello again on frame load and unregisters the load listener', () => {
    const target = new EventTarget();
    const frameTarget = new EventTarget();
    const postMessage = vi.fn();
    const frame = {
      contentWindow: { postMessage } as unknown as Window,
      addEventListener: frameTarget.addEventListener.bind(frameTarget),
      removeEventListener: vi.fn(frameTarget.removeEventListener.bind(frameTarget)),
    };
    const bridge = createPinBridge({
      frame,
      target: target as unknown as Window,
      onReady: vi.fn(),
      onKeyHold: vi.fn(),
      onPick: vi.fn(),
      onRects: vi.fn(),
    });

    frameTarget.dispatchEvent(new Event('load'));
    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'wyld:pin:hello' }, '*');
    bridge.stop();
    expect(frame.removeEventListener).toHaveBeenCalledWith('load', expect.any(Function));
    frameTarget.dispatchEvent(new Event('load'));
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it('answers hello from its parent and ignores hello from any other source', () => {
    const listeners = new Map<string, EventListener[]>();
    const parentWindow = { postMessage: vi.fn() };
    const frameWindow = {
      parent: parentWindow,
      addEventListener(type: string, listener: EventListener) {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
    };
    const documentStub = {
      readyState: 'loading',
      addEventListener: vi.fn(),
      createElement: () => ({ textContent: '' }),
      head: { appendChild: vi.fn() },
    };
    new Function('window', 'document', 'requestAnimationFrame', PIN_BRIDGE_SOURCE)(
      frameWindow,
      documentStub,
      vi.fn(),
    );
    const message = listeners.get('message')?.[0];
    const load = listeners.get('load')?.[0];
    expect(documentStub.addEventListener).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function),
    );
    const domContentLoaded = documentStub.addEventListener.mock.calls.find(
      ([type]) => type === 'DOMContentLoaded',
    )?.[1];

    domContentLoaded?.();
    expect(parentWindow.postMessage).toHaveBeenCalledWith({ type: 'wyld:pin:ready' }, '*');
    parentWindow.postMessage.mockClear();
    load?.({} as Event);
    expect(parentWindow.postMessage).toHaveBeenCalledWith({ type: 'wyld:pin:ready' }, '*');
    parentWindow.postMessage.mockClear();

    message?.({ source: {}, data: { type: 'wyld:pin:hello' } } as unknown as Event);
    expect(parentWindow.postMessage).not.toHaveBeenCalled();
    message?.({ source: parentWindow, data: { type: 'wyld:pin:hello' } } as unknown as Event);
    expect(parentWindow.postMessage).toHaveBeenCalledOnce();
    expect(parentWindow.postMessage).toHaveBeenCalledWith({ type: 'wyld:pin:ready' }, '*');
  });

  it('ignores messages with a null source when the frame has no content window', () => {
    const target = new EventTarget();
    const onReady = vi.fn();
    const bridge = createPinBridge({
      frame: { contentWindow: null },
      target: target as unknown as Window,
      onReady,
      onKeyHold: vi.fn(),
      onPick: vi.fn(),
      onRects: vi.fn(),
    });

    target.dispatchEvent(
      new MessageEvent('message', { data: { type: 'wyld:pin:ready' }, source: null }),
    );

    expect(onReady).not.toHaveBeenCalled();
    bridge.stop();
  });
});
