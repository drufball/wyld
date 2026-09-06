import { describe, expect, it } from 'vitest';

import { SCRUBBED_KEYS, scrubSecrets } from './scrub.js';

describe('scrubSecrets', () => {
  it('removes all scrubbed keys and returns their values', () => {
    const environment: NodeJS.ProcessEnv = {
      WAKE_URL: 'http://localhost:8797',
      WAKE_SECRET: 'wake-secret',
      NTFY_URL: 'http://localhost:8799/topic',
      NTFY_BASE_URL: '',
    };

    expect(scrubSecrets(environment)).toEqual({
      WAKE_URL: 'http://localhost:8797',
      WAKE_SECRET: 'wake-secret',
      NTFY_URL: 'http://localhost:8799/topic',
      NTFY_BASE_URL: '',
    });
    expect(SCRUBBED_KEYS.every((key) => !(key in environment))).toBe(true);
  });

  it('omits absent keys without adding them back to the environment', () => {
    const environment: NodeJS.ProcessEnv = { WAKE_SECRET: 'wake-secret' };

    expect(scrubSecrets(environment)).toEqual({ WAKE_SECRET: 'wake-secret' });
    expect(environment).toEqual({});
  });

  it('leaves unrelated environment variables untouched', () => {
    const environment: NodeJS.ProcessEnv = {
      WAKE_URL: 'http://localhost:8797',
      PAK_URL: 'http://localhost:8796',
      WAKE_PORT: '8797',
      PLANNER_HOST_PORT: '8798',
      CLAUDE_CODE_OAUTH_TOKEN: 'oauth-token',
      PATH: '/usr/bin',
    };

    scrubSecrets(environment);

    expect(environment).toEqual({
      PAK_URL: 'http://localhost:8796',
      WAKE_PORT: '8797',
      PLANNER_HOST_PORT: '8798',
      CLAUDE_CODE_OAUTH_TOKEN: 'oauth-token',
      PATH: '/usr/bin',
    });
  });
});
