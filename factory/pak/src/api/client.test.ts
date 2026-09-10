import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, getPresence, shipSpecies } from './client.js';

describe('API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves the server error when shipping species fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"error":"Nothing has been changed yet."}', {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const error = await shipSpecies().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Nothing has been changed yet.');
  });

  it('uses the workshop fallback when shipping returns a non-JSON error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));

    const error = await shipSpecies().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('The workshop could not ship.');
  });

  it('returns a valid ship result', async () => {
    const result = {
      shipped: true as const,
      summary: { added: ['fox'], removed: [], changed: [] },
      prUrl: 'https://example.com/pull/1',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    await expect(shipSpecies()).resolves.toEqual(result);
  });

  it('throws an ApiError with the response status and unchanged request message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 503 })));

    const error = await getPresence().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      name: 'ApiError',
      status: 503,
      body: 'nope',
      message: 'Loading presence failed (503): nope',
    });
  });
});
