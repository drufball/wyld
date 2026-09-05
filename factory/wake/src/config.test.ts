import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readConfig } from './config.js';

describe('readConfig', () => {
  it('validates and maps Wake configuration', () => {
    expect(
      readConfig({
        FACTORY_DIR: '/tmp/factory',
        WAKE_PORT: '9000',
        WAKE_SECRET: '1234567890123456',
        GH_WEBHOOK_SECRET: 'abcdefghijklmnop',
      }),
    ).toEqual({
      factoryDir: '/tmp/factory',
      databasePath: path.join('/tmp/factory', 'wake.sqlite'),
      port: 9000,
      wakeSecret: '1234567890123456',
      githubWebhookSecret: 'abcdefghijklmnop',
    });
  });
  it('requires sufficiently long secrets', () => {
    expect(() => readConfig({ WAKE_SECRET: 'short', GH_WEBHOOK_SECRET: 'also-short' })).toThrow(
      'Invalid Wake configuration',
    );
  });
});
