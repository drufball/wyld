import { describe, expect, it } from 'vitest';

import { Achievement, Health, Retro, SleepRun } from './ops.js';

const ts = '2026-09-05T12:30:00Z';

describe('operations schemas', () => {
  it('parses health, sleep run, retro, and achievement records', () => {
    expect(
      Health.parse({
        ts,
        plannerState: 'idle',
        wakeQueueDepth: 0,
        ghRateRemaining: 4999,
        ciState: 'green',
        costToday: 1.25,
        codexPrsOpen: 2,
      }),
    ).toBeTruthy();
    expect(
      SleepRun.parse({
        id: 'sleep-1',
        started: ts,
        ended: ts,
        phases: ['review'],
        outcome: 'complete',
        leftoversParked: ['quest-2'],
      }),
    ).toBeTruthy();
    expect(
      Retro.parse({
        id: 'retro-1',
        date: '2026-09-05',
        wins: ['Shipped'],
        misses: [],
        factoryImprovements: ['quest-3'],
        stats: { shipped: 1 },
      }),
    ).toBeTruthy();
    expect(
      Achievement.parse({
        id: 'achievement-1',
        name: 'First Ship',
        unlockedAt: ts,
        badge: 'rocket',
      }),
    ).toBeTruthy();
  });
  it('rejects representative invalid records', () => {
    expect(Health.safeParse({ ts, plannerState: 'idle' }).success).toBe(false);
    expect(SleepRun.safeParse({ id: 'sleep-1', started: 'today' }).success).toBe(false);
    expect(Retro.safeParse({ id: 'retro-1', date: ts, stats: { shipped: 'one' } }).success).toBe(
      false,
    );
    expect(
      Achievement.safeParse({ id: 'achievement-1', name: '', unlockedAt: ts, badge: 'rocket' })
        .success,
    ).toBe(false);
  });
});
