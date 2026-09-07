import { describe, expect, it } from 'vitest';
import { Event, type EventKind } from '@wyld/shared';

import { mechanicalDigest, type CatchupQuest } from './catchup.js';

const quest = (id: string, status: CatchupQuest['status']): CatchupQuest => ({
  id,
  worldId: 'pak',
  title: `Quest ${id}`,
  status,
});
const event = (
  id: number,
  kind: EventKind,
  questId?: string,
  payload: Record<string, unknown> = {},
) =>
  Event.parse({
    id,
    ts: '2026-09-05T12:00:00Z',
    source: kind.split('.')[0],
    kind,
    payload,
    ...(questId === undefined ? {} : { questId }),
  });

describe('mechanicalDigest', () => {
  it('builds shipped, demos, and every FYI category in the specified order', () => {
    const quests = [
      quest('done', 'done'),
      quest('demo', 'demo'),
      quest('park', 'parked'),
      quest('build', 'building'),
    ];
    const events = [
      event(1, 'planner.quest_updated', 'done', { status: 'done' }),
      event(2, 'planner.quest_updated', 'demo', { status: 'demo' }),
      event(3, 'planner.quest_updated', 'build', { status: 'building' }),
      event(4, 'system.resumed'),
      event(5, 'human.park', 'park'),
      event(6, 'system.paused', undefined, { reason: '' }),
    ];
    expect(mechanicalDigest({ events, quests })).toEqual({
      rumbles: [],
      shipped: [{ text: 'Quest done', deepLink: '/worlds/pak' }],
      demos: [{ text: 'Quest demo', deepLink: '/demos' }],
      fyi: [
        'The factory paused — something ran out.',
        'The factory is running again.',
        'Parked: Quest park.',
        'Started building: Quest build.',
      ],
    });
  });

  it('caps sections at eight, deduplicates quests, and skips deleted quests', () => {
    const quests = Array.from({ length: 10 }, (_, index) => quest(String(index), 'done'));
    const events = quests.map((item, index) =>
      event(index + 1, 'planner.quest_updated', item.id, { status: 'done' }),
    );
    events.push(event(20, 'planner.quest_updated', '0', { status: 'done' }));
    events.push(event(21, 'planner.quest_updated', 'deleted', { status: 'done' }));
    expect(mechanicalDigest({ events, quests }).shipped).toHaveLength(8);
  });

  it('includes up to eight open rumbles in the supplied order', () => {
    const openRumbles = Array.from({ length: 10 }, (_, id) => ({
      id: String(id),
      title: `Rumble ${id}`,
    }));
    expect(mechanicalDigest({ events: [], quests: [], openRumbles }).rumbles).toEqual(
      openRumbles.slice(0, 8).map(({ title }) => ({ text: title, deepLink: '/rumble' })),
    );
  });

  it('links a live demo line to its deep link and a disc line to its player', () => {
    const quests = [
      quest('disc', 'demo'),
      quest('deep-link', 'demo'),
      quest('url', 'demo'),
      quest('fallback', 'demo'),
      quest('pak', 'demo'),
    ];
    const events = [
      event(1, 'planner.quest_updated', 'disc', { status: 'demo' }),
      event(2, 'planner.quest_updated', 'deep-link', { status: 'demo' }),
      event(3, 'planner.quest_updated', 'url', { status: 'demo' }),
      event(4, 'planner.quest_updated', 'fallback', { status: 'demo' }),
      event(5, 'planner.quest_updated', 'pak', { status: 'demo' }),
    ];
    const demos = [
      {
        id: 'a-disc',
        questId: 'disc',
        summary: 'Play it.',
        kind: 'disc' as const,
        deepLink: null,
        url: '/play/a-disc/',
      },
      {
        id: 'live-deep-link',
        questId: 'deep-link',
        summary: 'Try the roadmap.',
        kind: 'live' as const,
        deepLink: '/roadmap',
        url: null,
      },
      {
        id: 'live-url',
        questId: 'url',
        summary: null,
        kind: 'live' as const,
        deepLink: null,
        url: '/memory',
      },
      {
        id: 'live-fallback',
        questId: 'fallback',
        summary: '   ',
        kind: 'live' as const,
        deepLink: null,
        url: null,
      },
      {
        id: 'branch',
        questId: 'pak',
        summary: 'Try the branch build.',
        kind: 'pak' as const,
        deepLink: null,
        url: '/play/branch/',
      },
    ];
    expect(mechanicalDigest({ events, quests, demos }).demos).toEqual([
      { text: 'Play it.', deepLink: '/demos/a-disc' },
      { text: 'Try the roadmap.', deepLink: '/roadmap' },
      { text: 'Quest url', deepLink: '/memory' },
      { text: 'Quest fallback', deepLink: '/demos' },
      { text: 'Try the branch build.', deepLink: '/demos/branch' },
    ]);
  });
});
