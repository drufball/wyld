import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

describe('readConfig', () => {
  it('uses defaults and treats empty values as unset', () => {
    const config = readConfig({
      PAK_URL: '',
      OPS_INTERVAL_SECONDS: '',
      OPS_REPO: '',
      OPS_USAGE_DIR: '',
    });
    expect(config).toMatchObject({
      pakUrl: 'http://localhost:8787',
      intervalSeconds: 120,
      repo: 'drufball/wyld',
      ghRatePauseBelow: 200,
      ghRateResumeAbove: 500,
      plannerStaleMinutes: 15,
      watchdogEnabled: true,
    });
    expect(config.usageDir).toBe(
      path.join(
        os.homedir(),
        '.claude',
        'projects',
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..').replaceAll('/', '-'),
      ),
    );
  });
  it('parses overrides and rejects short intervals', () => {
    expect(
      readConfig({
        PAK_URL: 'http://example.test',
        OPS_INTERVAL_SECONDS: '30',
        OPS_REPO: 'a/b',
        OPS_USAGE_DIR: '/tmp/usage',
        OPS_GH_RATE_PAUSE_BELOW: '100',
        OPS_GH_RATE_RESUME_ABOVE: '600',
        OPS_PLANNER_STALE_MINUTES: '20',
        OPS_WATCHDOG: 'false',
      }),
    ).toEqual({
      pakUrl: 'http://example.test',
      intervalSeconds: 30,
      repo: 'a/b',
      usageDir: '/tmp/usage',
      ghRatePauseBelow: 100,
      ghRateResumeAbove: 600,
      plannerStaleMinutes: 20,
      watchdogEnabled: false,
    });
    expect(() => readConfig({ OPS_INTERVAL_SECONDS: '29' })).toThrow('Invalid ops configuration');
    expect(() => readConfig({ OPS_WATCHDOG: 'yes' })).toThrow('Invalid ops configuration');
  });
});
