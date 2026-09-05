import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { z } from 'zod';

const defaultFactoryDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../.factory',
);

const Environment = z.object({
  FACTORY_DIR: z.string().min(1).default(defaultFactoryDir),
  PAK_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  WAKE_URL: z.url().optional(),
});

export type Config = {
  factoryDir: string;
  databasePath: string;
  port: number;
  wakeUrl?: string;
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
    ...(result.data.WAKE_URL === undefined ? {} : { wakeUrl: result.data.WAKE_URL }),
  };
}
