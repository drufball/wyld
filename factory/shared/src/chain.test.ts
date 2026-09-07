import { describe, expect, it } from 'vitest';

import { Chain, ChainKind } from './chain.js';

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
    expect(Chain.parse(valid)).toEqual({
      ...valid,
      tags: [],
      demoId: null,
      payload: null,
      anchor: null,
    });
    expect(ChainKind.options).toEqual([
      'question',
      'message',
      'rumble',
      'demo',
      'action',
      'unlock',
    ]);
  });

  it('applies card defaults and accepts a demo card', () => {
    expect(Chain.parse(valid)).toMatchObject({ tags: [], demoId: null, payload: null });
    expect(
      Chain.parse({
        ...valid,
        kind: 'demo',
        demoId: 'demo-one',
        tags: ['demo', 'disc'],
        payload: { title: 'Demo one' },
      }),
    ).toMatchObject({ kind: 'demo', demoId: 'demo-one' });
  });

  it('enforces the rumble and demo invariants', () => {
    expect(Chain.safeParse({ ...valid, kind: 'rumble' }).success).toBe(false);
    expect(Chain.safeParse({ ...valid, rumble: {} }).success).toBe(false);
    expect(Chain.safeParse({ ...valid, kind: 'demo' }).success).toBe(false);
    const result = Chain.safeParse({ ...valid, demoId: 'demo-one' });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.some(({ path }) => path[0] === 'demoId')).toBe(true);
  });

  it('rejects an empty message', () => {
    expect(() =>
      Chain.parse({ ...valid, messages: [{ ...valid.messages[0], text: '' }] }),
    ).toThrow();
  });
});
