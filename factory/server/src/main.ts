import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';

import packageMetadata from '../package.json' with { type: 'json' };
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { openDatabase } from './database.js';
import { log } from './logger.js';
import { createDemoBuilder } from './builder.js';

const config = readConfig();
const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
const database = openDatabase(config.databasePath, migrationsFolder);
const builder = createDemoBuilder({
  repoDir: config.repoDir,
  demosDir: config.demosDir,
  worktreesDir: config.worktreesDir,
  logger: log,
});
const app = createApp({
  database,
  repoDir: config.repoDir,
  worktreesDir: config.worktreesDir,
  version: packageMetadata.version,
  pakDist: config.pakDist,
  demosDir: config.demosDir,
  feedbackDir: config.feedbackDir,
  builder,
  ...(config.pakPublicUrl === undefined ? {} : { pakPublicUrl: config.pakPublicUrl }),
  ...(config.wakeUrl === undefined ? {} : { wakeUrl: config.wakeUrl }),
  ...(config.wakeSecret === undefined ? {} : { wakeSecret: config.wakeSecret }),
  ...(config.ntfyUrl === undefined ? {} : { ntfyUrl: config.ntfyUrl }),
  ntfyTopic: config.ntfyTopic,
  sleepConfig: config.sleep,
});

log(
  'info',
  fs.existsSync(path.join(config.pakDist, 'index.html'))
    ? 'Pak build found'
    : 'Pak build not found',
  {
    pakDist: config.pakDist,
  },
);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  log('info', 'Pak server listening', { port: info.port, databasePath: config.databasePath });
});
