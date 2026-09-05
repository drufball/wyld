import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readConfig } from './config.js';

describe('readConfig', () => {
  it('uses validated environment overrides', () => {
    expect(
      readConfig({
        FACTORY_DIR: '/tmp/factory',
        REPO_DIR: '/tmp/repo',
        PAK_PORT: '9000',
        PAK_DIST: '/tmp/pak-dist',
        WAKE_URL: 'http://localhost:8788/event',
        WAKE_SECRET: 'shared-secret',
      }),
    ).toEqual({
      factoryDir: '/tmp/factory',
      databasePath: path.join('/tmp/factory', 'pak.sqlite'),
      repoDir: '/tmp/repo',
      demosDir: '/tmp/factory/demos',
      worktreesDir: '/tmp/factory/worktrees',
      feedbackDir: '/tmp/factory/feedback',
      port: 9000,
      pakDist: '/tmp/pak-dist',
      wakeUrl: 'http://localhost:8788/event',
      wakeSecret: 'shared-secret',
    });
  });

  it.each([
    ['empty', { WAKE_URL: '', WAKE_SECRET: '' }],
    ['whitespace-only', { WAKE_URL: ' \t\n', WAKE_SECRET: '  ' }],
    ['absent', {}],
  ])('treats %s Wake settings as unset', (_description, environment) => {
    const config = readConfig(environment);

    expect(config.wakeUrl).toBeUndefined();
    expect(config.wakeSecret).toBeUndefined();
    expect(config).not.toHaveProperty('wakeUrl');
    expect(config).not.toHaveProperty('wakeSecret');
  });

  it('rejects a malformed non-empty Wake URL', () => {
    expect(() => readConfig({ WAKE_URL: 'not-a-url', WAKE_SECRET: 'shared-secret' })).toThrow(
      'Invalid server configuration',
    );
  });

  it('resolves the default Pak build directory relative to the server module', () => {
    expect(readConfig({}).pakDist).toBe(
      path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../pak/dist'),
    );
  });

  it('fails clearly for an invalid port', () => {
    expect(() => readConfig({ PAK_PORT: 'not-a-port' })).toThrow('Invalid server configuration');
  });
});
