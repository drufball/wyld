import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const defaultFactoryDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../.factory',
);
const Environment = z.object({
  FACTORY_DIR: z.string().min(1).default(defaultFactoryDir),
  WAKE_PORT: z.coerce.number().int().min(1).max(65535).default(8788),
  WAKE_SECRET: z.string().min(16),
  GH_WEBHOOK_SECRET: z.string().min(16),
});

export type Config = {
  factoryDir: string;
  databasePath: string;
  port: number;
  wakeSecret: string;
  githubWebhookSecret: string;
};

export function readConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const result = Environment.safeParse(environment);
  if (!result.success)
    throw new Error(`Invalid Wake configuration: ${z.prettifyError(result.error)}`);
  return {
    factoryDir: result.data.FACTORY_DIR,
    databasePath: path.join(result.data.FACTORY_DIR, 'wake.sqlite'),
    port: result.data.WAKE_PORT,
    wakeSecret: result.data.WAKE_SECRET,
    githubWebhookSecret: result.data.GH_WEBHOOK_SECRET,
  };
}
