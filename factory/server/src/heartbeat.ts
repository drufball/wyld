import { desc, eq } from 'drizzle-orm';
import type { NewEvent } from '@wyld/shared';

import type { AppDatabase } from './database.js';
import { events } from './schema.js';

type PlannerHeartbeatDependencies = {
  database: AppDatabase;
  now: () => Date;
  storeEvent: (event: NewEvent) => Promise<unknown>;
  enabled: boolean;
  setIntervalFn?: typeof setInterval;
};

export function createPlannerHeartbeat(dependencies: PlannerHeartbeatDependencies) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const tick = async () => {
    if (!dependencies.enabled) return;
    const current = dependencies.now();
    if (current.getUTCMinutes() < 3) return;
    const hour = current.toISOString().slice(0, 13);
    const latest = dependencies.database.db
      .select()
      .from(events)
      .where(eq(events.kind, 'planner.tick'))
      .orderBy(desc(events.ts))
      .get();
    if (latest?.ts.slice(0, 13) === hour) return;
    await dependencies.storeEvent({
      source: 'planner',
      kind: 'planner.tick',
      payload: { at: current.toISOString() },
    });
  };
  return {
    tick,
    start: () => {
      if (!dependencies.enabled || timer) return;
      timer = (dependencies.setIntervalFn ?? setInterval)(() => void tick(), 60_000);
      timer.unref?.();
    },
    stop: () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}
