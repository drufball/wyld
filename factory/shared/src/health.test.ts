import { describe, expect, it } from 'vitest';

import {
  CiState,
  HealthReport,
  HealthSnapshot,
  ModelLimited,
  OpsReport,
  PauseLane,
  PlannerState,
} from './health.js';

describe('health schemas', () => {
  it('exports and validates reports', () => {
    expect(PlannerState.parse('working')).toBe('working');
    expect(CiState.parse('pass')).toBe('pass');
    expect(HealthReport.parse({ plannerState: 'idle', wakeQueueDepth: 0 })).toEqual({
      plannerState: 'idle',
      wakeQueueDepth: 0,
    });
    expect(HealthReport.safeParse({ plannerState: 'idle', extra: true }).success).toBe(false);
    const modelLimited = {
      since: '2026-09-12T08:32:00.000Z',
      until: '2026-09-17T19:00:00.000Z',
      primary: 'claude-fable-5-1',
    };
    expect(ModelLimited.parse(modelLimited)).toEqual(modelLimited);
    expect(
      HealthReport.safeParse({
        plannerState: 'working',
        model: 'claude-opus-4-6',
        lastTurnAt: '2026-09-12T08:27:00.000Z',
        modelLimited,
      }).success,
    ).toBe(true);
  });

  it('validates strict ops reports and non-negative counts', () => {
    expect(OpsReport.parse({ ciState: 'pass', codexPrsOpen: 0 })).toEqual({
      ciState: 'pass',
      codexPrsOpen: 0,
    });
    expect(OpsReport.safeParse({ ciState: 'pass', codexPrsOpen: 0, extra: true }).success).toBe(
      false,
    );
    expect(OpsReport.safeParse({ ciState: 'pass', codexPrsOpen: -1 }).success).toBe(false);
  });

  it('validates snapshots', () => {
    expect(PauseLane.options).toEqual(['codex', 'github', 'planner', 'all']);
    expect(
      HealthSnapshot.safeParse({
        ts: '2026-01-01T00:00:00.000Z',
        planner: {
          state: 'down',
          model: 'claude-fable-5-1',
          lastTurnAt: '2026-01-01T00:00:00.000Z',
          modelLimited: {
            since: '2026-01-01T00:00:00.000Z',
            primary: 'claude-fable-5-1',
          },
        },
        server: { ok: true, db: 'ok', uptimeSeconds: 1, version: '1.0.0', eventsToday: 0 },
        wake: { reachable: false },
        github: {
          ciState: 'pass',
          ciDetail: 'main is green',
          rateLimit: 5000,
          reportedAt: '2026-01-01T00:00:00.000Z',
          source: 'ops',
        },
        tokensToday: 123,
        paused: {
          lane: 'codex',
          reason: 'Quota exhausted',
          fix: 'Wait for the quota window',
          since: '2026-01-01T00:00:00.000Z',
        },
      }).success,
    ).toBe(true);
  });
});
