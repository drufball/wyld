import type { Logger, ModelLimited } from '@wyld/shared';

export type HeartbeatState = {
  turnInFlight: boolean;
  lastTurnAt: string | null;
  model: string;
  modelLimited?: ModelLimited;
};

export function formatUntil(until: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(new Date(until));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('hour')}:${part('minute')} ${part('weekday')}`;
}

type Timer = ReturnType<typeof setTimeout>;

export function createHeartbeat(options: {
  pakUrl: string;
  intervalSeconds: number;
  state: () => HeartbeatState;
  log: Logger;
  fetch?: typeof fetch;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
}) {
  const request = options.fetch ?? fetch;
  const schedule = options.setTimeout ?? setTimeout;
  const unschedule = options.clearTimeout ?? clearTimeout;
  let running = false;
  let disabledLogged = false;
  let timer: Timer | undefined;

  const beat = async (): Promise<void> => {
    const { turnInFlight, lastTurnAt, model, modelLimited } = options.state();
    const normalTask = turnInFlight
      ? 'Handling events'
      : lastTurnAt === null
        ? 'Waiting for events — no turn yet'
        : `Waiting for events — last turn ${new Date(lastTurnAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}`;
    const limitedSuffix =
      modelLimited?.until === undefined ? '' : ` until ${formatUntil(modelLimited.until)}`;
    const fallbackWorking = modelLimited !== undefined && model !== modelLimited.primary;
    const paused = modelLimited !== undefined && model === modelLimited.primary;
    const currentTask = (
      fallbackWorking
        ? `Model limit on ${modelLimited.primary} — running on ${model}${limitedSuffix}`
        : paused
          ? `Model limit — retrying${limitedSuffix}`
          : normalTask
    ).slice(0, 200);
    try {
      const response = await request(new URL('/api/health/report', options.pakUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(2_000),
        body: JSON.stringify({
          plannerState: paused ? 'paused' : turnInFlight ? 'working' : 'idle',
          currentTask,
          model,
          ...(lastTurnAt === null ? {} : { lastTurnAt }),
          ...(modelLimited === undefined ? {} : { modelLimited }),
          ...(paused ? { pausedReason: `model limit${limitedSuffix}` } : {}),
        }),
      });
      if (!response.ok)
        options.log('warn', 'planner heartbeat failed', {
          status: response.status,
          error: `HTTP ${response.status}`,
        });
    } catch (error) {
      options.log('warn', 'planner heartbeat failed', { error: String(error) });
    }
  };

  const tick = async () => {
    if (!running) return;
    await beat();
    if (running)
      timer = schedule(() => {
        timer = undefined;
        void tick();
      }, options.intervalSeconds * 1_000);
  };

  return {
    start() {
      if (options.intervalSeconds === 0) {
        if (!disabledLogged) {
          disabledLogged = true;
          options.log('info', 'planner heartbeat disabled');
        }
        return;
      }
      if (running) return;
      running = true;
      void tick();
    },
    stop() {
      running = false;
      if (timer !== undefined) {
        unschedule(timer);
        timer = undefined;
      }
    },
    beat,
  };
}
