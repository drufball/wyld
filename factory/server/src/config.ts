import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { z } from 'zod';

const defaultFactoryDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../.factory',
);
const defaultPakDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../pak/dist');

const emptyStringAsUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const Environment = z.object({
  FACTORY_DIR: z.string().min(1).default(defaultFactoryDir),
  PAK_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  PAK_DIST: z.string().min(1).default(defaultPakDist),
  WAKE_URL: z.preprocess(emptyStringAsUndefined, z.url().optional()),
  WAKE_SECRET: z.preprocess(emptyStringAsUndefined, z.string().optional()),
});

export type Config = {
  factoryDir: string;
  databasePath: string;
  port: number;
  pakDist: string;
  wakeUrl?: string;
  wakeSecret?: string;
};

export function readConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const result = Environment.safeParse(environment);
  if (!result.success) {
    throw new Error(`Invalid server configuration: ${z.prettifyError(result.error)}`);
  }
  return {
    factoryDir: result.data.FACTORY_DIR,
    databasePath: path.join(result.data.FACTORY_DIR, 'pak.sqlite'),
    port: result.data.PAK_PORT,
    pakDist: result.data.PAK_DIST,
    ...(result.data.WAKE_URL === undefined ? {} : { wakeUrl: result.data.WAKE_URL }),
    ...(result.data.WAKE_SECRET === undefined ? {} : { wakeSecret: result.data.WAKE_SECRET }),
  };
}
