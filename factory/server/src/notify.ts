import { log, type LogContext } from './logger.js';

export type NotifyOptions = { tags?: string[]; click?: string; priority?: number };
export type Notifier = (title: string, message: string, options?: NotifyOptions) => void;

export function createNotifier(dependencies: {
  ntfyUrl?: string;
  topic: string;
  fetch?: typeof globalThis.fetch;
  logger?: (level: 'info' | 'error', msg: string, context?: LogContext) => void;
}): Notifier {
  const logger = dependencies.logger ?? log;
  if (dependencies.ntfyUrl === undefined) {
    logger('info', 'NTFY_URL is not configured; push notifications are disabled');
    return () => undefined;
  }

  const fetcher = dependencies.fetch ?? globalThis.fetch;
  const url = `${dependencies.ntfyUrl.replace(/\/+$/, '')}/`;
  return (title, message, options = {}): void => {
    void Promise.resolve()
      .then(() =>
        fetcher(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            topic: dependencies.topic,
            title,
            message,
            ...(options.tags === undefined ? {} : { tags: options.tags }),
            ...(options.click === undefined ? {} : { click: options.click }),
            ...(options.priority === undefined ? {} : { priority: options.priority }),
          }),
          signal: AbortSignal.timeout(2_000),
        }),
      )
      .then((response) => {
        if (!response.ok) throw new Error(`ntfy returned HTTP ${response.status}`);
      })
      .catch((error: unknown) =>
        logger('error', 'failed to send push notification', { error: String(error) }),
      );
  };
}
