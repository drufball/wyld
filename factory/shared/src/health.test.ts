import { describe, expect, it } from 'vitest';

import { CiState, HealthReport, HealthSnapshot, PlannerState } from './health.js';

describe('health schemas', () => {
  it('exports and validates reports', () => {
    expect(PlannerState.parse('working')).toBe('working');
    expect(CiState.parse('pass')).toBe('pass');
    expect(HealthReport.parse({ plannerState: 'idle', wakeQueueDepth: 0 })).toEqual({
      plannerState: 'idle',
      wakeQueueDepth: 0,
    });
    expect(HealthReport.safeParse({ plannerState: 'idle', extra: true }).success).toBe(false);
  });

  it('validates snapshots', () => {
    expect(
      HealthSnapshot.safeParse({
        ts: '2026-01-01T00:00:00.000Z',
        planner: { state: 'down' },
        server: { ok: true, db: 'ok', uptimeSeconds: 1, version: '1.0.0', eventsToday: 0 },
        wake: { reachable: false },
        github: { ciState: 'unknown' },
      }).success,
    ).toBe(true);
  });
});
