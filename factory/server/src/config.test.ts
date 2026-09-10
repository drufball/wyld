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
        PAK_PUBLIC_URL: 'https://pak.example/base',
        WAKE_URL: 'http://localhost:8788/event',
        WAKE_SECRET: 'shared-secret',
        NTFY_URL: 'https://ntfy.example',
        NTFY_TOPIC: 'custom-topic',
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
      pakPublicUrl: 'https://pak.example/base',
      wakeUrl: 'http://localhost:8788/event',
      wakeSecret: 'shared-secret',
      ntfyUrl: 'https://ntfy.example',
      ntfyTopic: 'custom-topic',
      plannerTick: true,
      sleep: {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        goodnight: '23:00',
        lastCall: '07:15',
        lightsOn: '08:00',
        enabled: true,
      },
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

  it('defaults the ntfy topic and treats an empty URL as unset', () => {
    const config = readConfig({ NTFY_URL: '' });
    expect(config.ntfyTopic).toBe('wyld-pak');
    expect(config).not.toHaveProperty('ntfyUrl');
  });

  it('treats an empty public Pak URL as unset', () => {
    const config = readConfig({ PAK_PUBLIC_URL: '' });
    expect(config).not.toHaveProperty('pakPublicUrl');
  });

  it('rejects a malformed non-empty public Pak URL', () => {
    expect(() => readConfig({ PAK_PUBLIC_URL: 'not-a-url' })).toThrow(
      'Invalid server configuration',
    );
  });

  it('rejects a malformed non-empty ntfy URL', () => {
    expect(() => readConfig({ NTFY_URL: 'not-a-url' })).toThrow('Invalid server configuration');
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

  it('fails clearly for an invalid sleep wall time', () => {
    expect(() => readConfig({ SLEEP_GOODNIGHT: '25:99' })).toThrow('must be HH:MM (24-hour time)');
  });

  it('can disable the sleep schedule', () => {
    expect(readConfig({ SLEEP_SCHEDULE: 'off' }).sleep.enabled).toBe(false);
  });

  it('can disable the planner heartbeat', () => {
    expect(readConfig({ PLANNER_TICK: 'off' }).plannerTick).toBe(false);
  });
});
