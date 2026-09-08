import { describe, expect, it } from 'vitest';

import { CatchupDigest, CatchupLine, NextAction, Presence } from './presence.js';

const presence = {
  lastSeenAt: '2026-09-05T12:30:00Z',
  lastCatchupEventId: null,
  nextAction: { text: 'Play demo', deepLink: '/demos/1' },
};

describe('presence schemas', () => {
  it('accepts next actions with and without an in-app deep link', () => {
    expect(NextAction.parse({ text: 'Play demo', deepLink: '/demos/1' })).toEqual({
      text: 'Play demo',
      deepLink: '/demos/1',
    });
    expect(NextAction.parse({ text: 'Play demo' })).toEqual({ text: 'Play demo' });
    expect(NextAction.parse({ text: 'Demos', deepLink: '/demos' }).deepLink).toBe('/demos');
    expect(NextAction.parse({ text: 'Home', deepLink: '/' }).deepLink).toBe('/');
  });

  it('accepts an optional ISO back-at instant and rejects invalid timestamps', () => {
    expect(NextAction.parse({ text: 'Wait', backAt: '2026-09-06T16:30:00.000Z' })).toEqual({
      text: 'Wait',
      backAt: '2026-09-06T16:30:00.000Z',
    });
    expect(NextAction.safeParse({ text: 'Wait', backAt: 'tomorrow' }).success).toBe(false);
  });

  it('rejects invalid next actions', () => {
    expect(NextAction.safeParse({ text: '' }).success).toBe(false);
    expect(NextAction.safeParse({ text: 'Leave', deepLink: 'https://example.com' }).success).toBe(
      false,
    );
    expect(NextAction.safeParse({ text: 'Leave', deepLink: '//example.com' }).success).toBe(false);
  });

  it('accepts a presence without a next action yet', () => {
    expect(Presence.parse({ ...presence, nextAction: null })).toEqual({
      ...presence,
      nextAction: null,
      needsYou: 0,
    });
  });

  it('parses presence and catch-up digest lines', () => {
    expect(Presence.parse(presence)).toEqual({ ...presence, needsYou: 0 });
    expect(CatchupDigest.parse({ rumbles: [], demos: [], shipped: [], fyi: [] })).toBeTruthy();
    expect(CatchupLine.safeParse({ text: '', deepLink: '//outside' }).success).toBe(false);
  });
  it('rejects missing actions and invalid generators', () => {
    expect(Presence.safeParse({ ...presence, nextAction: undefined }).success).toBe(false);
    expect(Presence.safeParse({ ...presence, lastCatchupEventId: 'event-1' }).success).toBe(false);
  });
});
