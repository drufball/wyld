import { describe, expect, it } from 'vitest';

import { Chain } from './chain.js';

describe('Chain', () => {
  const valid = {
    id: 1,
    kind: 'question',
    status: 'open',
    createdAt: '2026-09-05T12:00:00.000Z',
    lastActivityAt: '2026-09-05T12:00:00.000Z',
    questId: null,
    snoozedUntil: null,
    rumble: null,
    messages: [
      {
        id: 1,
        chainId: 1,
        author: 'human',
        text: 'What is happening?',
        ts: '2026-09-05T12:00:00.000Z',
      },
    ],
  } as const;

  it('parses a valid chain', () => {
    expect(Chain.parse(valid)).toEqual(valid);
  });

  it('rejects an empty message', () => {
    expect(() =>
      Chain.parse({ ...valid, messages: [{ ...valid.messages[0], text: '' }] }),
    ).toThrow();
  });
});
