import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { emptyStringAsUndefined } from '@wyld/shared';
import { z } from 'zod';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const Environment = z.object({
  PAK_URL: z.preprocess(emptyStringAsUndefined, z.url().default('http://localhost:8787')),
  OPS_INTERVAL_SECONDS: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().int().min(30).default(120),
  ),
  OPS_REPO: z.preprocess(emptyStringAsUndefined, z.string().min(1).default('drufball/wyld')),
  OPS_USAGE_DIR: z.preprocess(emptyStringAsUndefined, z.string().min(1).optional()),
  // Separate pause/resume thresholds provide hysteresis, preventing boundary flapping.
  OPS_GH_RATE_PAUSE_BELOW: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().int().min(0).default(200),
  ),
  OPS_GH_RATE_RESUME_ABOVE: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().int().min(0).default(500),
  ),
  OPS_PLANNER_STALE_MINUTES: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().positive().default(15),
  ),
  OPS_PLANNER_NO_TURN_MINUTES: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().positive().default(120),
  ),
  OPS_WATCHDOG: z.preprocess(
    emptyStringAsUndefined,
    z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .default(true),
  ),
});

export type Config = {
  pakUrl: string;
  intervalSeconds: number;
  repo: string;
  usageDir: string;
  ghRatePauseBelow: number;
  ghRateResumeAbove: number;
  plannerStaleMinutes: number;
  plannerNoTurnMinutes: number;
  watchdogEnabled: boolean;
};

export function readConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const result = Environment.safeParse(environment);
  if (!result.success) {
    throw new Error(`Invalid ops configuration: ${z.prettifyError(result.error)}`);
  }
  return {
    pakUrl: result.data.PAK_URL,
    intervalSeconds: result.data.OPS_INTERVAL_SECONDS,
    repo: result.data.OPS_REPO,
    ghRatePauseBelow: result.data.OPS_GH_RATE_PAUSE_BELOW,
    ghRateResumeAbove: result.data.OPS_GH_RATE_RESUME_ABOVE,
    plannerStaleMinutes: result.data.OPS_PLANNER_STALE_MINUTES,
    plannerNoTurnMinutes: result.data.OPS_PLANNER_NO_TURN_MINUTES,
    watchdogEnabled: result.data.OPS_WATCHDOG,
    usageDir:
      result.data.OPS_USAGE_DIR ??
      path.join(os.homedir(), '.claude', 'projects', repoRoot.replaceAll('/', '-')),
  };
}
