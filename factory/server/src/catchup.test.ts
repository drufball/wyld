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

  it('uses the first demo card summary and deep link, with title fallback', () => {
    const quests = [quest('card', 'demo'), quest('fallback', 'demo')];
    const events = [
      event(1, 'planner.quest_updated', 'card', { status: 'demo' }),
      event(2, 'planner.quest_updated', 'fallback', { status: 'demo' }),
    ];
    const demos = [
      { id: 'z-card', questId: 'card', summary: 'Later summary' },
      { id: 'a-card', questId: 'card', summary: 'Try the new flow.' },
      { id: 'blank', questId: 'fallback', summary: '   ' },
    ];
    expect(mechanicalDigest({ events, quests, demos }).demos).toEqual([
      { text: 'Try the new flow.', deepLink: '/demos/a-card' },
      { text: 'Quest fallback', deepLink: '/demos/blank' },
    ]);
  });
});
