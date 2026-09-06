import type { Event } from '@wyld/shared';

import { log, type LogContext } from './logger.js';

export type WakeForwarderDependencies = {
  wakeUrl?: string;
  wakeSecret?: string;
  fetch?: typeof globalThis.fetch;
  logger?: (level: 'info' | 'error', msg: string, context?: LogContext) => void;
};

export function createWakeForwarder(dependencies: WakeForwarderDependencies) {
  const logger = dependencies.logger ?? log;
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  if (dependencies.wakeUrl !== undefined && dependencies.wakeSecret === undefined) {
    logger('error', 'WAKE_URL is configured without WAKE_SECRET; Wake forwarding is disabled');
  }
  return (event: Event): void => {
    if (event.source !== 'human' || event.kind === 'human.seen') return;
    if (dependencies.wakeUrl === undefined || dependencies.wakeSecret === undefined) return;
    const url = new URL('/event', dependencies.wakeUrl).toString();
    void Promise.resolve()
      .then(() =>
        fetcher(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Wake-Secret': dependencies.wakeSecret!,
          },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(2_000),
        }),
      )
      .then((response) => {
        if (!response.ok) throw new Error(`Wake returned HTTP ${response.status}`);
      })
      .catch((error: unknown) =>
        logger('error', 'failed to forward to Wake', { eventId: event.id, error: String(error) }),
      );
  };
}

export type WakePauseNotifier = (pausedSince: string | null) => void;

export function createWakePauseNotifier(
  dependencies: WakeForwarderDependencies,
): WakePauseNotifier {
  const logger = dependencies.logger ?? log;
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  return (pausedSince): void => {
    if (dependencies.wakeUrl === undefined || dependencies.wakeSecret === undefined) return;
    const path = pausedSince === null ? '/resume' : '/pause';
    void Promise.resolve()
      .then(() =>
        fetcher(new URL(path, dependencies.wakeUrl).toString(), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Wake-Secret': dependencies.wakeSecret!,
          },
          body: JSON.stringify(pausedSince === null ? {} : { since: pausedSince }),
          signal: AbortSignal.timeout(2_000),
        }),
      )
      .then((response) => {
        if (!response.ok) throw new Error(`Wake returned HTTP ${response.status}`);
      })
      .catch((error: unknown) =>
        logger('error', 'failed to update Wake pause state', { path, error: String(error) }),
      );
  };
}
