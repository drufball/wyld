import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

describe('readConfig', () => {
  it('provides host defaults', () => {
    const config = readConfig({ WAKE_SECRET: 'x'.repeat(16) });
    expect(config).toMatchObject({
      wakePort: 8788,
      port: 8789,
      model: 'claude-fable-5-1',
      pollMs: 2000,
      idleTimeoutMs: 900000,
    });
    expect(config.sessionFilePath).toBe(`${config.repoRoot}/.factory/planner-session.json`);
  });
  it('requires a Wake secret', () => expect(() => readConfig({})).toThrow('WAKE_SECRET'));
});
