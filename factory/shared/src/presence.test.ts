import { describe, expect, it } from 'vitest';

import { Catchup, Presence } from './presence.js';

const presence = {
  lastSeenAt: '2026-09-05T12:30:00Z',
  lastCatchupEventId: 'event-1',
  nextAction: { text: 'Play demo', deepLink: '/demos/1' },
};
const catchup = {
  id: 'catchup-1',
  fromEventId: 'event-1',
  toEventId: 'event-9',
  digest: { rumbles: ['rumble-1'], demos: ['demo-1'], shipped: ['quest-1'], fyi: ['All healthy'] },
  generatedBy: 'planner',
};

describe('presence schemas', () => {
  it('parses presence and catchups', () => {
    expect(Presence.parse(presence)).toEqual(presence);
    expect(Catchup.parse(catchup)).toEqual(catchup);
  });
  it('rejects missing actions and invalid generators', () => {
    expect(Presence.safeParse({ ...presence, nextAction: undefined }).success).toBe(false);
    expect(Catchup.safeParse({ ...catchup, generatedBy: 'human' }).success).toBe(false);
  });
});
