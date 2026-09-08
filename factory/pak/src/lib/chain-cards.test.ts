import type { Chain } from '@wyld/shared';
import { describe, expect, it } from 'vitest';
import { lookCard, unlockCard } from './chain-cards.js';

const base: Chain = {
  id: 1,
  kind: 'message',
  status: 'open',
  createdAt: '2026-09-05T12:00:00Z',
  lastActivityAt: '2026-09-05T12:00:00Z',
  questId: null,
  anchor: null,
  snoozedUntil: null,
  pinnedAt: null,
  tags: [],
  demoId: null,
  payload: null,
  rumble: null,
  messages: [],
};

describe('chain card payloads', () => {
  it('reads the explainer off a look chain', () => {
    expect(lookCard({ ...base, tags: ['look'], payload: { explainer: 'species' } })).toEqual({
      explainer: 'species',
    });
  });

  it('ignores a chain with no explainer', () => {
    expect(lookCard(base)).toBeNull();
  });

  it('narrows unlocks', () => {
    expect(
      unlockCard({
        ...base,
        kind: 'unlock',
        payload: { achievementId: 'first', name: 'First', badge: '🏆' },
      }),
    ).toEqual({ achievementId: 'first', name: 'First', badge: '🏆' });
  });
});
