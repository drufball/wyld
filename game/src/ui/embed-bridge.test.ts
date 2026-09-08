import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { installEmbedBridge } from './embed-bridge.js';

let target: EventTarget & { __wyld: typeof window.__wyld };
let original: typeof window.__wyld;
beforeEach(() => {
  target = Object.assign(new EventTarget(), { __wyld: {} as typeof window.__wyld });
  vi.stubGlobal('window', target);
  original = window.__wyld;
});
afterEach(() => {
  window.__wyld = original;
  vi.unstubAllGlobals();
});

const request = (data: unknown) => {
  const source = { postMessage: vi.fn() } as unknown as Window;
  const event = new Event('message') as MessageEvent;
  Object.defineProperties(event, { data: { value: data }, source: { value: source } });
  window.dispatchEvent(event);
  return source.postMessage as ReturnType<typeof vi.fn>;
};

it('answers a capture request with the screenshot and state', () => {
  window.__wyld = {
    ...original,
    screenshot: () => 'data:image/jpeg;base64,YQ==',
    getState: () => ({ day: 2 }) as never,
  };
  const stop = installEmbedBridge();
  const post = request({ type: 'wyld:demo:capture', id: 7 });
  expect(post).toHaveBeenCalledWith(
    {
      type: 'wyld:demo:capture:result',
      id: 7,
      screenshot: 'data:image/jpeg;base64,YQ==',
      state: { day: 2 },
    },
    '*',
  );
  stop();
});

it('reports null for a field whose getter throws', () => {
  window.__wyld = {
    ...original,
    screenshot: () => {
      throw new Error('no');
    },
    getState: () => ({ day: 2 }) as never,
  };
  const stop = installEmbedBridge();
  expect(request({ type: 'wyld:demo:capture', id: 1 })).toHaveBeenCalledWith(
    expect.objectContaining({ screenshot: null, state: { day: 2 } }),
    '*',
  );
  stop();
});

it('ignores messages that are not capture requests', () => {
  const stop = installEmbedBridge();
  expect(request({ type: 'other' })).not.toHaveBeenCalled();
  stop();
});

it('stops listening when uninstalled', () => {
  const stop = installEmbedBridge();
  stop();
  expect(request({ type: 'wyld:demo:capture', id: 1 })).not.toHaveBeenCalled();
});
