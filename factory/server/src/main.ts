import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';

import packageMetadata from '../package.json' with { type: 'json' };
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { openDatabase } from './database.js';
import { log } from './logger.js';

const config = readConfig();
const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
const database = openDatabase(config.databasePath, migrationsFolder);
const app = createApp({
  database,
  version: packageMetadata.version,
  ...(config.wakeUrl === undefined ? {} : { wakeUrl: config.wakeUrl }),
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  log('info', 'Pak server listening', { port: info.port, databasePath: config.databasePath });
});
