import { HealthSnapshot } from '@wyld/shared';

import type { Config } from './config.js';
import { log } from '@wyld/shared';

// Codex is deliberately absent: ops neither runs Codex nor sees its quota errors, and treating a
// long-running task as inactivity would create false positives. The Planner sees Codex failures
// directly and reports exhaustion through the pak_pause tool instead.

export type WatchdogInput = {
  ghRateRemaining?: number;
  plannerLastReportAt?: string;
  plannerModelLimited?: { since: string; until?: string; primary: string };
  plannerModel?: string;
  plannerLastTurnAt?: string;
  wakeQueueDepth?: number;
  activePause?: { lane: string; reason: string };
  activePausedLanes: string[];
  now: Date;
};

export type WatchdogAction =
  | { action: 'pause'; lane: 'github' | 'planner'; reason: string; fix?: string }
  | { action: 'resume'; lane: 'github' | 'planner' };

type WatchdogConfig = Pick<
  Config,
  'ghRatePauseBelow' | 'ghRateResumeAbove' | 'plannerStaleMinutes' | 'plannerNoTurnMinutes'
>;

export function modelLimitReason(limited: { until?: string }, now: Date): string {
  if (limited.until === undefined) return 'model limit';
  const until = new Date(limited.until);
  if (Number.isNaN(until.getTime()) || until <= now) return 'model limit';
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(until);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `model limit until ${value('hour')}:${value('minute')} ${value('weekday')}`;
}

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
  const fullyModelLimited =
    input.plannerModelLimited !== undefined &&
    input.plannerModel === input.plannerModelLimited.primary;
  const turnElapsedMinutes = input.plannerLastTurnAt
    ? (input.now.getTime() - new Date(input.plannerLastTurnAt).getTime()) / 60_000
    : undefined;
  // Taking queued work while continuing to heartbeat, but completing no turn for this long, means
  // the host's queries are being refused. This backs up hosts unable to report modelLimited.
  const noTurn =
    (input.wakeQueueDepth ?? 0) > 0 &&
    (turnElapsedMinutes === undefined || turnElapsedMinutes > config.plannerNoTurnMinutes);
  const modelLimitTriggered = fullyModelLimited || noTurn;
  const activePlannerReason =
    input.activePause?.lane === 'planner' ? input.activePause.reason : undefined;
  const modelLimitPaused = plannerPaused && activePlannerReason?.startsWith('model limit') === true;

  if (modelLimitTriggered && !plannerPaused) {
    actions.push({
      action: 'pause',
      lane: 'planner',
      reason: fullyModelLimited
        ? modelLimitReason(input.plannerModelLimited!, input.now)
        : 'model limit',
      fix: fullyModelLimited
        ? "It clears when the account's model limit resets"
        : 'Nothing is lost; the queued events are still waiting',
    });
  } else if (!modelLimitTriggered && modelLimitPaused) {
    actions.push({ action: 'resume', lane: 'planner' });
  }

  const elapsedMinutes = input.plannerLastReportAt
    ? (input.now.getTime() - new Date(input.plannerLastReportAt).getTime()) / 60_000
    : undefined;
  const plannerStale = elapsedMinutes === undefined || elapsedMinutes > config.plannerStaleMinutes;
  const stalenessPaused =
    plannerPaused && activePlannerReason?.startsWith("I haven't checked in for ") === true;
  if (!modelLimitTriggered && plannerStale && !plannerPaused) {
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
  } else if (!plannerStale && stalenessPaused) {
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
      plannerModelLimited: snapshot.planner.modelLimited,
      plannerModel: snapshot.planner.model,
      plannerLastTurnAt: snapshot.planner.lastTurnAt,
      wakeQueueDepth: snapshot.wake.queueDepth,
      activePause: snapshot.paused,
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
      if (
        action.lane === 'planner' &&
        snapshot.paused?.lane === 'planner' &&
        snapshot.paused.reason.startsWith('model limit')
      ) {
        try {
          const notifyResponse = await fetch(`${baseUrl}/api/notify`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              title: 'The factory is back',
              message: "The model limit cleared — I'm working again.",
              tags: ['white_check_mark'],
            }),
            signal: AbortSignal.timeout(10_000),
          });
          if (!notifyResponse.ok)
            throw new Error(`Pak notify returned HTTP ${notifyResponse.status}`);
        } catch (error: unknown) {
          log('error', 'watchdog recovery notification failed', { error: String(error) });
        }
      }
    }
  }
}
