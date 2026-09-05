import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const emptyStringAsUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const Environment = z.object({
  PAK_URL: z.preprocess(emptyStringAsUndefined, z.url().default('http://localhost:8787')),
  OPS_INTERVAL_SECONDS: z.preprocess(
    emptyStringAsUndefined,
    z.coerce.number().int().min(30).default(120),
  ),
  OPS_REPO: z.preprocess(emptyStringAsUndefined, z.string().min(1).default('drufball/wyld')),
  OPS_USAGE_DIR: z.preprocess(emptyStringAsUndefined, z.string().min(1).optional()),
});

export type Config = {
  pakUrl: string;
  intervalSeconds: number;
  repo: string;
  usageDir: string;
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
    usageDir:
      result.data.OPS_USAGE_DIR ??
      path.join(os.homedir(), '.claude', 'projects', repoRoot.replaceAll('/', '-')),
  };
}
