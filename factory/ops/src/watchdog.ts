import { HealthSnapshot } from '@wyld/shared';

import type { Config } from './config.js';
import { log } from '@wyld/shared';

// Codex is deliberately absent: ops neither runs Codex nor sees its quota errors, and treating a
// long-running task as inactivity would create false positives. The Planner sees Codex failures
// directly and reports exhaustion through the pak_pause tool instead.

export type WatchdogInput = {
  ghRateRemaining?: number;
  plannerLastReportAt?: string;
  activePausedLanes: string[];
  now: Date;
};

export type WatchdogAction =
  | { action: 'pause'; lane: 'github' | 'planner'; reason: string; fix?: string }
  | { action: 'resume'; lane: 'github' | 'planner' };

type WatchdogConfig = Pick<
  Config,
  'ghRatePauseBelow' | 'ghRateResumeAbove' | 'plannerStaleMinutes'
>;

export function decideWatchdogActions(
  input: WatchdogInput,
  config: WatchdogConfig,
): WatchdogAction[] {
  if (input.activePausedLanes.includes('all')) return [];

  const actions: WatchdogAction[] = [];
  const githubPaused = input.activePausedLanes.includes('github');
  if (
    input.ghRateRemaining !== undefined &&
    input.ghRateRemaining < config.ghRatePauseBelow &&
    !githubPaused
  ) {
    actions.push({
      action: 'pause',
      lane: 'github',
      reason: `GitHub's API budget is nearly gone (${input.ghRateRemaining} calls left)`,
      fix: 'It refills on its own within the hour',
    });
  } else if (
    input.ghRateRemaining !== undefined &&
    input.ghRateRemaining > config.ghRateResumeAbove &&
    githubPaused
  ) {
    actions.push({ action: 'resume', lane: 'github' });
  }

  const plannerPaused = input.activePausedLanes.includes('planner');
  const elapsedMinutes = input.plannerLastReportAt
    ? (input.now.getTime() - new Date(input.plannerLastReportAt).getTime()) / 60_000
    : undefined;
  const plannerStale = elapsedMinutes === undefined || elapsedMinutes > config.plannerStaleMinutes;
  if (plannerStale && !plannerPaused) {
    const minutes =
      elapsedMinutes === undefined
        ? config.plannerStaleMinutes
        : Math.max(config.plannerStaleMinutes, Math.floor(elapsedMinutes));
    actions.push({
      action: 'pause',
      lane: 'planner',
      reason: `I haven't checked in for ${minutes} minutes`,
      fix: 'Restarting the Planner brings it back',
    });
  } else if (!plannerStale && plannerPaused) {
    actions.push({ action: 'resume', lane: 'planner' });
  }
  return actions;
}

export async function runWatchdog(
  config: WatchdogConfig & Pick<Config, 'pakUrl'>,
  ghRateRemaining: number | undefined,
  now: Date,
): Promise<void> {
  const baseUrl = config.pakUrl.replace(/\/$/, '');
  const snapshotResponse = await fetch(`${baseUrl}/api/health/snapshot`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!snapshotResponse.ok)
    throw new Error(`Pak snapshot returned HTTP ${snapshotResponse.status}`);
  const snapshot = HealthSnapshot.parse(await snapshotResponse.json());
  const activePausedLanes = snapshot.paused ? [snapshot.paused.lane] : [];
  const actions = decideWatchdogActions(
    {
      ghRateRemaining,
      plannerLastReportAt: snapshot.planner.lastReportAt,
      activePausedLanes,
      now,
    },
    config,
  );

  for (const action of actions) {
    const response = await fetch(`${baseUrl}/api/${action.action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        action.action === 'pause'
          ? { lane: action.lane, reason: action.reason, fix: action.fix }
          : { lane: action.lane },
      ),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Pak ${action.action} returned HTTP ${response.status}`);
    if (action.action === 'pause') {
      log('info', 'watchdog paused a lane', { lane: action.lane, reason: action.reason });
    } else {
      log('info', 'watchdog resumed a lane', { lane: action.lane });
    }
  }
}
