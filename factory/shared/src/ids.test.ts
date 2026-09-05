import { describe, expect, it } from 'vitest';

import { Id, Timestamp } from './ids.js';

describe('shared primitives', () => {
  it('parses identifiers and ISO timestamps', () => {
    expect(Id.parse('quest-1')).toBe('quest-1');
    expect(Timestamp.parse('2026-09-05T12:30:00.000Z')).toBe('2026-09-05T12:30:00.000Z');
  });

  it('rejects empty identifiers and non-ISO timestamps', () => {
    expect(Id.safeParse('').success).toBe(false);
    expect(Timestamp.safeParse('yesterday').success).toBe(false);
  });
});
