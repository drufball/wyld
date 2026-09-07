import type { Chain } from '@wyld/shared';
import { describe, expect, it } from 'vitest';
import { demoCard, unlockCard } from './chain-cards.js';

const base: Chain = {
  id: 1,
  kind: 'message',
  status: 'open',
  createdAt: '2026-09-05T12:00:00Z',
  lastActivityAt: '2026-09-05T12:00:00Z',
  questId: null,
  snoozedUntil: null,
  tags: [],
  demoId: null,
  payload: null,
  rumble: null,
  messages: [],
};

describe('chain card payloads', () => {
  it('uses safe defaults for an old demo payload', () => {
    expect(
      demoCard({
        ...base,
        kind: 'demo',
        demoId: 'old',
        payload: { title: 'Old', deepLink: '/try' },
      }),
    ).toEqual({
      demoId: 'old',
      title: 'Old',
      demoKind: 'live',
      summary: null,
      steps: [],
      seeded: [],
      deepLink: '/try',
      url: '/try',
      status: 'ready',
      builtAt: null,
      error: null,
    });
  });
  it('rejects unusable demos and narrows unlocks', () => {
    expect(demoCard(base)).toBeNull();
    expect(
      unlockCard({
        ...base,
        kind: 'unlock',
        payload: { achievementId: 'first', name: 'First', badge: '🏆' },
      }),
    ).toEqual({ achievementId: 'first', name: 'First', badge: '🏆' });
  });
});
