import { describe, expect, it } from 'vitest';

import { Quest, QuestLink, World } from './quest.js';

describe('quest schemas', () => {
  it('parses valid worlds, quests, and links', () => {
    expect(
      World.parse({ id: 'world-1', name: 'WYLD', kind: 'game', order: 0, icon: 'tree' }),
    ).toBeTruthy();
    expect(
      Quest.parse({
        id: 'quest-1',
        worldId: 'world-1',
        title: 'Forest',
        pitch: 'Grow it',
        status: 'building',
        progress: 0.5,
        sinceYouLooked: 'Started',
        lastNote: 'Green',
      }),
    ).toBeTruthy();
    expect(
      QuestLink.parse({ questId: 'quest-1', ghKind: 'issue', ghRef: '5', state: 'open' }),
    ).toBeTruthy();
  });

  it('rejects invalid enum values and missing required fields', () => {
    expect(
      World.safeParse({ id: 'world-1', name: 'WYLD', kind: 'website', order: 0, icon: 'tree' })
        .success,
    ).toBe(false);
    expect(Quest.safeParse({ id: 'quest-1' }).success).toBe(false);
    expect(
      QuestLink.safeParse({ questId: 'quest-1', ghKind: 'commit', ghRef: '5', state: 'open' })
        .success,
    ).toBe(false);
  });
});
