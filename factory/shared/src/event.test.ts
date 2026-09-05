import { describe, expect, it } from 'vitest';

import { EVENT_KINDS, Event, EventSource, NewEvent } from './event.js';

const newEvent = {
  source: 'human',
  kind: 'human.intent',
  payload: { text: 'Build a forest' },
} as const;

describe('Event', () => {
  it('parses events and client-created events', () => {
    expect(Event.parse({ id: 'event-1', ts: '2026-09-05T12:30:00Z', ...newEvent })).toMatchObject(
      newEvent,
    );
    expect(NewEvent.parse(newEvent)).toEqual(newEvent);
  });

  it('rejects invalid kinds and server-assigned fields on new events', () => {
    expect(
      Event.safeParse({
        id: 'event-1',
        ts: '2026-09-05T12:30:00Z',
        ...newEvent,
        kind: 'human.nope',
      }).success,
    ).toBe(false);
    expect(NewEvent.safeParse({ ...newEvent, id: 'event-1' }).success).toBe(false);
    expect(NewEvent.safeParse({ ...newEvent, ts: '2026-09-05T12:30:00Z' }).success).toBe(false);
  });

  it('keeps every kind in the documented source.snake_case vocabulary', () => {
    for (const kind of EVENT_KINDS) {
      const [source, verb, extra] = kind.split('.');
      expect(extra).toBeUndefined();
      expect(EventSource.safeParse(source).success).toBe(true);
      expect(verb).toMatch(/^[a-z]+(?:_[a-z]+)*$/);
    }
  });
});
