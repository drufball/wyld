import { describe, expect, it } from 'vitest';

import { decideWatchdogActions, type WatchdogInput } from './watchdog.js';

const config = { ghRatePauseBelow: 200, ghRateResumeAbove: 500, plannerStaleMinutes: 15 };
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
    expect(decide({ activePausedLanes: ['planner'] })).toEqual([
      { action: 'resume', lane: 'planner' },
    ]);
    expect(
      decide({ plannerLastReportAt: '2026-09-06T11:45:00.000Z', activePausedLanes: ['planner'] }),
    ).toEqual([{ action: 'resume', lane: 'planner' }]);
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
