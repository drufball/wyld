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
      }),
    ).toEqual({
      pakUrl: 'http://example.test',
      intervalSeconds: 30,
      repo: 'a/b',
      usageDir: '/tmp/usage',
    });
    expect(() => readConfig({ OPS_INTERVAL_SECONDS: '29' })).toThrow('Invalid ops configuration');
  });
});
