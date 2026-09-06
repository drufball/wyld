import { describe, expect, it, vi } from 'vitest';

import { createNotifier } from './notify.js';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createNotifier', () => {
  it('warns once and never fetches when disabled', async () => {
    const fetch = vi.fn();
    const logger = vi.fn();
    const notify = createNotifier({ topic: 'wyld-pak', fetch, logger });
    notify('one', 'message');
    notify('two', 'message');
    await settle();
    expect(fetch).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledOnce();
    expect(logger).toHaveBeenCalledWith(
      'info',
      'NTFY_URL is not configured; push notifications are disabled',
    );
  });

  it('posts the required JSON and omits absent options', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('', { status: 200 }));
    createNotifier({ ntfyUrl: 'https://ntfy.example/base/', topic: 'wyld-pak', fetch })(
      'Title',
      'Body',
    );
    await settle();
    expect(fetch).toHaveBeenCalledWith('https://ntfy.example/base/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'wyld-pak', title: 'Title', message: 'Body' }),
      signal: expect.any(AbortSignal),
    });
  });

  it('includes supplied options', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('', { status: 200 }));
    createNotifier({ ntfyUrl: 'https://ntfy.example', topic: 'topic', fetch })('T', 'M', {
      tags: ['warning'],
      click: 'https://pak.example',
      priority: 5,
    });
    await settle();
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual({
      topic: 'topic',
      title: 'T',
      message: 'M',
      tags: ['warning'],
      click: 'https://pak.example',
      priority: 5,
    });
  });

  it('retries a failed fetch once without logging when the retry succeeds', async () => {
    vi.useFakeTimers();
    const logger = vi.fn();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    createNotifier({ ntfyUrl: 'https://ntfy.example', topic: 'topic', fetch, logger })('T', 'M');

    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(logger).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0]![1]?.signal).not.toBe(fetch.mock.calls[1]![1]?.signal);
    vi.useRealTimers();
  });

  it.each([
    ['non-2xx responses', async () => new Response('', { status: 503 })],
    [
      'rejected fetches',
      async () => {
        throw new Error('offline');
      },
    ],
  ])('retries %s once, then logs exactly once without throwing', async (_case, implementation) => {
    vi.useFakeTimers();
    const logger = vi.fn();
    const fetch = vi.fn(implementation);
    const notify = createNotifier({
      ntfyUrl: 'https://ntfy.example',
      topic: 'topic',
      fetch,
      logger,
    });
    expect(() => notify('T', 'M')).not.toThrow();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledWith(
      'error',
      'failed to send push notification',
      expect.objectContaining({ error: expect.any(String) }),
    );
    vi.useRealTimers();
  });
});
