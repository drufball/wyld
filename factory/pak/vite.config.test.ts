// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { pwaOptions } from './vite.config.js';

describe('PWA navigation fallback', () => {
  it('does not intercept game routes', () => {
    const denylist = pwaOptions.workbox.navigateFallbackDenylist;

    expect(denylist).toEqual(expect.arrayContaining([expect.any(RegExp)]));
    expect(denylist.some((pattern) => pattern.test('/play/main/'))).toBe(true);
  });
});
