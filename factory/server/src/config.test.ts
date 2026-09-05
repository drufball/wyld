import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readConfig } from './config.js';

describe('readConfig', () => {
  it('uses validated environment overrides', () => {
    expect(
      readConfig({
        FACTORY_DIR: '/tmp/factory',
        PAK_PORT: '9000',
        WAKE_URL: 'http://localhost:8788/event',
      }),
    ).toEqual({
      factoryDir: '/tmp/factory',
      databasePath: path.join('/tmp/factory', 'pak.sqlite'),
      port: 9000,
      wakeUrl: 'http://localhost:8788/event',
    });
  });

  it('fails clearly for an invalid port', () => {
    expect(() => readConfig({ PAK_PORT: 'not-a-port' })).toThrow('Invalid server configuration');
  });
});
