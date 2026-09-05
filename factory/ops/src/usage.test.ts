import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readTokensToday } from './usage.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true }))));

describe('readTokensToday', () => {
  it('streams valid entries from the current UTC day', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'wyld-ops-')); directories.push(directory);
    const usage = { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 };
    const line = (timestamp: string, model = 'claude') => JSON.stringify({ type: 'assistant', timestamp, message: { model, usage } });
    await writeFile(path.join(directory, 'one.jsonl'), [line('2026-09-05T01:00:00Z'), line('2026-09-04T23:59:59Z'), '{bad', line('2026-09-05T02:00:00Z', '<synthetic>'), JSON.stringify({ type: 'user' })].join('\n'));
    await writeFile(path.join(directory, 'two.jsonl'), `${line('2026-09-05T20:00:00Z')}\n`);
    expect(await readTokensToday(directory, new Date('2026-09-05T12:00:00Z'))).toBe(20);
  });
  it('returns undefined for a missing directory', async () => {
    expect(await readTokensToday('/definitely/missing/wyld-ops', new Date())).toBeUndefined();
  });
});
