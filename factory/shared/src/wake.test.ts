import { describe, expect, it } from 'vitest';

import { WakeMessage, WakeMessageWire } from './wake.js';

const message = {
  source: 'github',
  kind: 'github.pr_opened',
  quest: 'quest-1',
  issue: 5,
  pr: 12,
  url: 'https://github.com/drufball/wyld/pull/12',
  summary: 'A pull request opened.',
  ts: '2026-09-05T12:30:00Z',
};

describe('WakeMessage', () => {
  it('parses a normalized Wake message', () => expect(WakeMessage.parse(message)).toEqual(message));
  it('rejects invalid event vocabulary and required fields', () => {
    expect(WakeMessage.safeParse({ ...message, kind: 'github.raw_webhook' }).success).toBe(false);
    expect(WakeMessage.safeParse({ ...message, summary: undefined }).success).toBe(false);
  });
});

describe('WakeMessageWire', () => {
  it('accepts event kinds and sources unknown to this build', () => {
    expect(
      WakeMessageWire.parse({ ...message, kind: 'github.raw_webhook', source: 'future-system' }),
    ).toEqual({ ...message, kind: 'github.raw_webhook', source: 'future-system' });
  });

  it.each([{ summary: undefined }, { kind: '' }, { ts: 'not-a-timestamp' }])(
    'rejects invalid wire fields: %o',
    (override) => {
      expect(WakeMessageWire.safeParse({ ...message, ...override }).success).toBe(false);
    },
  );
});
