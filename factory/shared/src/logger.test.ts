import { describe, expect, it, vi } from 'vitest';

import { createLogger, log, type LogStream } from './logger.js';

declare const process: { stdout: LogStream };

describe('logger', () => {
  it('writes one parseable JSON line per call with context at the top level', () => {
    const lines: string[] = [];
    const logger = createLogger({ write: (chunk) => lines.push(chunk) });

    logger('info', 'first message', { quest: 'internals', count: 2 });
    logger('warn', 'second message');

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      ts: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      level: 'info',
      msg: 'first message',
      quest: 'internals',
      count: 2,
    });
    expect(new Date(JSON.parse(lines[0]!).ts).toISOString()).toBe(JSON.parse(lines[0]!).ts);
  });

  it('writes to process.stdout when no stream is provided', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      log('debug', 'stdout message');
      expect(write).toHaveBeenCalledOnce();
    } finally {
      write.mockRestore();
    }
  });

  it('ends each line with a single newline', () => {
    const lines: string[] = [];
    createLogger({ write: (chunk) => lines.push(chunk) })('error', 'failed');
    expect(lines[0]).toMatch(/[^\n]\n$/);
  });
});
