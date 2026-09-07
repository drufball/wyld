// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { pwaOptions } from './vite.config.js';

describe('Pak Vite config', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('does not intercept game routes', () => {
    const denylist = pwaOptions.workbox.navigateFallbackDenylist;

    expect(denylist).toEqual(expect.arrayContaining([expect.any(RegExp)]));
    expect(denylist.some((pattern) => pattern.test('/play/main/'))).toBe(true);
    expect(denylist.some((pattern) => pattern.test('/artifacts/roadmap/'))).toBe(true);
  });

  it('uses PAK_BASE while preserving the play denylist', async () => {
    vi.stubEnv('PAK_BASE', '/play/branch-check/');
    const { default: configured, pwaOptions: options } =
      await import('./vite.config.js?pak-base-test');

    expect(configured.base).toBe('/play/branch-check/');
    expect(
      options.workbox.navigateFallbackDenylist.some((pattern) => pattern.test('/play/main/')),
    ).toBe(true);
    expect(
      options.workbox.navigateFallbackDenylist.some((pattern) =>
        pattern.test('/artifacts/roadmap/'),
      ),
    ).toBe(true);
  });

  it('proxies artifact documents to the server', async () => {
    const { default: configured } = await import('./vite.config.js');
    expect(configured.server?.proxy).toHaveProperty('/artifacts');
  });
});
