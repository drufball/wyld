import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { z } from 'zod';

const defaultFactoryDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../.factory',
);
const defaultRepoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const defaultPakDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../pak/dist');

const emptyStringAsUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const Environment = z.object({
  FACTORY_DIR: z.string().min(1).default(defaultFactoryDir),
  REPO_DIR: z.string().min(1).default(defaultRepoDir),
  PAK_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  PAK_DIST: z.string().min(1).default(defaultPakDist),
  PAK_PUBLIC_URL: z.preprocess(emptyStringAsUndefined, z.url().optional()),
  WAKE_URL: z.preprocess(emptyStringAsUndefined, z.url().optional()),
  WAKE_SECRET: z.preprocess(emptyStringAsUndefined, z.string().optional()),
  NTFY_URL: z.preprocess(emptyStringAsUndefined, z.url().optional()),
  NTFY_TOPIC: z.string().min(1).default('wyld-pak'),
});

export type Config = {
  factoryDir: string;
  databasePath: string;
  repoDir: string;
  demosDir: string;
  worktreesDir: string;
  feedbackDir: string;
  port: number;
  pakDist: string;
  pakPublicUrl?: string;
  wakeUrl?: string;
  wakeSecret?: string;
  ntfyUrl?: string;
  ntfyTopic: string;
};

export function readConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const result = Environment.safeParse(environment);
  if (!result.success) {
    throw new Error(`Invalid server configuration: ${z.prettifyError(result.error)}`);
  }
  return {
    factoryDir: result.data.FACTORY_DIR,
    databasePath: path.join(result.data.FACTORY_DIR, 'pak.sqlite'),
    repoDir: result.data.REPO_DIR,
    demosDir: path.join(result.data.FACTORY_DIR, 'demos'),
    worktreesDir: path.join(result.data.FACTORY_DIR, 'worktrees'),
    feedbackDir: path.join(result.data.FACTORY_DIR, 'feedback'),
    port: result.data.PAK_PORT,
    pakDist: result.data.PAK_DIST,
    ...(result.data.PAK_PUBLIC_URL === undefined
      ? {}
      : { pakPublicUrl: result.data.PAK_PUBLIC_URL }),
    ...(result.data.WAKE_URL === undefined ? {} : { wakeUrl: result.data.WAKE_URL }),
    ...(result.data.WAKE_SECRET === undefined ? {} : { wakeSecret: result.data.WAKE_SECRET }),
    ...(result.data.NTFY_URL === undefined ? {} : { ntfyUrl: result.data.NTFY_URL }),
    ntfyTopic: result.data.NTFY_TOPIC,
  };
}
