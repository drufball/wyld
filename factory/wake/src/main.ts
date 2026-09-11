import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';

import packageMetadata from '../package.json' with { type: 'json' };
import { createWakeApp } from './app.js';
import { readConfig } from './config.js';
import { openDatabase } from './database.js';
import { log } from '@wyld/shared';

const config = readConfig();
const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
const database = openDatabase(config.databasePath, migrationsFolder);
const app = createWakeApp({
  database,
  wakeSecret: config.wakeSecret,
  githubWebhookSecret: config.githubWebhookSecret,
  version: packageMetadata.version,
});
serve({ fetch: app.fetch, port: config.port }, (info) =>
  log('info', 'Wake listening', { port: info.port, databasePath: config.databasePath }),
);
