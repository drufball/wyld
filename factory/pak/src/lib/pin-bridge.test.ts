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
    const bridge = createPinBridge({ frame, target, onReady, onPick, onRects });
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
      1,
      { type: 'wyld:pin:mode', on: true },
      '*',
    );
    expect(contentWindow.postMessage).toHaveBeenNthCalledWith(
      2,
      { type: 'wyld:pin:locate', elements: ['hero'] },
      '*',
    );
    bridge.stop();
    expect(listeners.size).toBe(0);
  });
});
