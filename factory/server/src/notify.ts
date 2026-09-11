import { log, type Logger } from '@wyld/shared';

export type NotifyOptions = { tags?: string[]; click?: string; priority?: number };
export type Notifier = (title: string, message: string, options?: NotifyOptions) => void;

export function createNotifier(dependencies: {
  ntfyUrl?: string;
  topic: string;
  fetch?: typeof globalThis.fetch;
  logger?: Logger;
}): Notifier {
  const logger = dependencies.logger ?? log;
  if (dependencies.ntfyUrl === undefined) {
    logger('info', 'NTFY_URL is not configured; push notifications are disabled');
    return () => undefined;
  }

  const fetcher = dependencies.fetch ?? globalThis.fetch;
  const url = `${dependencies.ntfyUrl.replace(/\/+$/, '')}/`;
  return (title, message, options = {}): void => {
    const send = async (): Promise<void> => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetcher(url, {
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
          });
          if (!response.ok) throw new Error(`ntfy returned HTTP ${response.status}`);
          return;
        } catch (error: unknown) {
          if (attempt === 1) {
            logger('error', 'failed to send push notification', { error: String(error) });
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
      }
    };
    void send();
  };
}
