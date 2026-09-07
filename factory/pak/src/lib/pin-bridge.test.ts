import { externalReference } from '@wyld/shared';
import { describe, expect, it, vi } from 'vitest';
import { createPinBridge, PIN_BRIDGE_SNIPPET, PIN_BRIDGE_SOURCE } from './pin-bridge.js';

describe('pin bridge', () => {
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
