import { describe, expect, it } from 'vitest';
import { relativeTime } from './words.js';

describe('relativeTime', () => {
  const now = new Date('2026-09-05T12:00:00.000Z');

  it.each([
    ['2026-09-05T11:59:31.000Z', 'just now'],
    ['2026-09-05T11:56:00.000Z', '4m ago'],
    ['2026-09-05T09:30:00.000Z', '2h ago'],
    ['2026-09-02T10:00:00.000Z', '3d ago'],
  ])('describes %s as %s', (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });
});
