import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const emptyStringAsUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const optionalNumber = z.preprocess(
  emptyStringAsUndefined,
  z.coerce.number().int().positive().optional(),
);

const Environment = z.object({
  FACTORY_DIR: z.preprocess(
    emptyStringAsUndefined,
    z.string().min(1).default(path.join(repoRoot, '.factory')),
  ),
  WAKE_PORT: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().int().min(1).max(65535).default(8788),
  ),
  WAKE_SECRET: z.string().min(16),
  PAK_URL: z.preprocess(emptyStringAsUndefined, z.url().default('http://localhost:8787')),
  PLANNER_HOST_PORT: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().int().min(1).max(65535).default(8789),
  ),
  PLANNER_HOST_HEARTBEAT_SECONDS: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().int().min(0).default(120),
  ),
  PLANNER_HOST_MODEL: z.preprocess(
    emptyStringAsUndefined,
    z.string().min(1).default('claude-fable-5-1'),
  ),
  PLANNER_HOST_POLL_MS: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().int().positive().default(2_000),
  ),
  PLANNER_HOST_IDLE_TIMEOUT_MS: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().int().positive().default(900_000),
  ),
  PLANNER_HOST_MAX_TURNS: optionalNumber,
  PLANNER_HOST_FIRST_MESSAGE: z.preprocess(emptyStringAsUndefined, z.string().min(1).optional()),
  PLANNER_HOST_CLAUDE_PATH: z.preprocess(emptyStringAsUndefined, z.string().min(1).optional()),
});

export type Config = {
  factoryDir: string;
  wakePort: number;
  wakeSecret: string;
  pakUrl: string;
  port: number;
  heartbeatSeconds: number;
  model: string;
  pollMs: number;
  idleTimeoutMs: number;
  maxTurns?: number;
  firstMessage?: string;
  claudePath?: string;
  repoRoot: string;
  sessionFilePath: string;
};

export function readConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const result = Environment.safeParse(environment);
  if (!result.success)
    throw new Error(`Invalid planner host configuration: ${z.prettifyError(result.error)}`);
  const d = result.data;
  return {
    factoryDir: d.FACTORY_DIR,
    wakePort: d.WAKE_PORT,
    wakeSecret: d.WAKE_SECRET,
    pakUrl: d.PAK_URL,
    port: d.PLANNER_HOST_PORT,
    heartbeatSeconds: d.PLANNER_HOST_HEARTBEAT_SECONDS,
    model: d.PLANNER_HOST_MODEL,
    pollMs: d.PLANNER_HOST_POLL_MS,
    idleTimeoutMs: d.PLANNER_HOST_IDLE_TIMEOUT_MS,
    maxTurns: d.PLANNER_HOST_MAX_TURNS,
    firstMessage: d.PLANNER_HOST_FIRST_MESSAGE,
    claudePath: d.PLANNER_HOST_CLAUDE_PATH,
    repoRoot,
    sessionFilePath: path.join(d.FACTORY_DIR, 'planner-session.json'),
  };
}
