import { describe, expect, it } from 'vitest';

import { decideWatchdogActions, modelLimitReason, type WatchdogInput } from './watchdog.js';

const config = {
  ghRatePauseBelow: 200,
  ghRateResumeAbove: 500,
  plannerStaleMinutes: 15,
  plannerNoTurnMinutes: 120,
};
const now = new Date('2026-09-06T12:00:00.000Z');
const freshPlanner = '2026-09-06T11:50:00.000Z';

function decide(overrides: Partial<WatchdogInput> = {}) {
  return decideWatchdogActions(
    {
      ghRateRemaining: 300,
      plannerLastReportAt: freshPlanner,
      activePausedLanes: [],
      now,
      ...overrides,
    },
    config,
  );
}

describe('decideWatchdogActions', () => {
  it('pauses GitHub below its lower threshold only when not already paused', () => {
    expect(decide({ ghRateRemaining: 199 })).toEqual([
      {
        action: 'pause',
        lane: 'github',
        reason: "GitHub's API budget is nearly gone (199 calls left)",
        fix: 'It refills on its own within the hour',
      },
    ]);
    expect(decide({ ghRateRemaining: 199, activePausedLanes: ['github'] })).toEqual([]);
  });

  it('resumes GitHub only above its upper threshold and does nothing in the hysteresis band', () => {
    expect(decide({ ghRateRemaining: 501, activePausedLanes: ['github'] })).toEqual([
      { action: 'resume', lane: 'github' },
    ]);
    expect(decide({ ghRateRemaining: 500, activePausedLanes: ['github'] })).toEqual([]);
    expect(decide({ ghRateRemaining: 200 })).toEqual([]);
  });

  it('does nothing when the GitHub budget is unknown', () => {
    expect(decide({ ghRateRemaining: undefined })).toEqual([]);
  });

  it('pauses a stale or missing Planner heartbeat only when not already paused', () => {
    expect(decide({ plannerLastReportAt: '2026-09-06T11:44:00.000Z' })).toEqual([
      {
        action: 'pause',
        lane: 'planner',
        reason: "I haven't checked in for 16 minutes",
        fix: 'Restarting the Planner brings it back',
      },
    ]);
    expect(decide({ plannerLastReportAt: undefined })).toEqual([
      expect.objectContaining({ action: 'pause', lane: 'planner' }),
    ]);
    expect(
      decide({
        plannerLastReportAt: '2026-09-06T11:44:00.000Z',
        activePausedLanes: ['planner'],
      }),
    ).toEqual([]);
  });

  it('resumes a paused Planner when its heartbeat is within the window', () => {
    expect(
      decide({
        activePausedLanes: ['planner'],
        activePause: { lane: 'planner', reason: "I haven't checked in for 20 minutes" },
      }),
    ).toEqual([{ action: 'resume', lane: 'planner' }]);
    expect(
      decide({
        plannerLastReportAt: '2026-09-06T11:45:00.000Z',
        activePausedLanes: ['planner'],
        activePause: { lane: 'planner', reason: "I haven't checked in for 20 minutes" },
      }),
    ).toEqual([{ action: 'resume', lane: 'planner' }]);
  });

  it('pauses the planner lane with the reset time when every model is refused', () => {
    process.env.TZ = 'Europe/London';
    expect(
      decide({
        now: new Date('2026-09-17T18:00:00.000Z'),
        plannerModel: 'primary',
        plannerModelLimited: {
          since: '2026-09-12T08:32:00.000Z',
          until: '2026-09-17T19:00:00.000Z',
          primary: 'primary',
        },
      }),
    ).toEqual([
      {
        action: 'pause',
        lane: 'planner',
        reason: 'model limit until 20:00 Thu',
        fix: "It clears when the account's model limit resets",
      },
    ]);
  });

  it('pauses with a plain model limit reason when no reset time is known', () => {
    expect(
      decide({
        plannerModel: 'primary',
        plannerModelLimited: { since: now.toISOString(), primary: 'primary' },
      }),
    ).toEqual([
      {
        action: 'pause',
        lane: 'planner',
        reason: 'model limit',
        fix: "It clears when the account's model limit resets",
      },
    ]);
  });

  it('does not pause while the host is working on its fallback model', () => {
    expect(
      decide({
        plannerModel: 'fallback',
        plannerModelLimited: { since: now.toISOString(), primary: 'primary' },
      }),
    ).toEqual([]);
  });

  it('pauses when the wake queue is non-empty and no turn has completed for two hours', () => {
    expect(decide({ wakeQueueDepth: 1, plannerLastTurnAt: undefined })).toEqual([
      {
        action: 'pause',
        lane: 'planner',
        reason: 'model limit',
        fix: 'Nothing is lost; the queued events are still waiting',
      },
    ]);
    expect(decide({ wakeQueueDepth: 1, plannerLastTurnAt: '2026-09-06T10:01:00.000Z' })).toEqual(
      [],
    );
  });

  it('does not pause for a stale turn when the wake queue is empty', () => {
    expect(decide({ wakeQueueDepth: 0, plannerLastTurnAt: '2026-09-01T00:00:00.000Z' })).toEqual(
      [],
    );
  });

  it('reports a model limit rather than a missed check-in', () => {
    expect(
      decide({
        plannerLastReportAt: '2026-09-01T00:00:00.000Z',
        plannerModel: 'primary',
        plannerModelLimited: { since: now.toISOString(), primary: 'primary' },
      }),
    ).toEqual([expect.objectContaining({ reason: 'model limit' })]);
  });

  it('resumes the planner lane only when the model limit has cleared', () => {
    const paused = {
      activePausedLanes: ['planner'],
      activePause: { lane: 'planner', reason: 'model limit until 20:00 Thu' },
    };
    expect(
      decide({
        ...paused,
        plannerModel: 'primary',
        plannerModelLimited: { since: now.toISOString(), primary: 'primary' },
      }),
    ).toEqual([]);
    expect(decide(paused)).toEqual([{ action: 'resume', lane: 'planner' }]);
  });

  it('leaves a staleness pause alone when the model limit clears', () => {
    expect(
      decide({
        activePausedLanes: ['planner'],
        activePause: { lane: 'planner', reason: "I haven't checked in for 20 minutes" },
        plannerLastReportAt: undefined,
      }),
    ).toEqual([]);
  });

  it('formats the reset time as time then short weekday', () => {
    process.env.TZ = 'Europe/London';
    const clock = new Date('2026-09-17T18:00:00.000Z');
    expect(modelLimitReason({ until: '2026-09-17T19:00:00.000Z' }, clock)).toBe(
      'model limit until 20:00 Thu',
    );
    expect(modelLimitReason({ until: '2026-09-17T17:00:00.000Z' }, clock)).toBe('model limit');
    expect(modelLimitReason({ until: 'nope' }, clock)).toBe('model limit');
  });

  it('does nothing while lane all is paused', () => {
    expect(
      decide({
        ghRateRemaining: 0,
        plannerLastReportAt: undefined,
        activePausedLanes: ['all'],
      }),
    ).toEqual([]);
  });
});
