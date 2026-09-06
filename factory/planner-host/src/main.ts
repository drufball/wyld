import { readConfig } from './config.js';
import { startHealthServer } from './health.js';
import { createHost } from './host.js';
import { log } from './logger.js';
import { createQueueClient } from './queue.js';

process.env.WAKE_CHANNEL_PUSH = '0';
const config = readConfig();
if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
  log(
    'warn',
    'Anthropic API credentials outrank the subscription token; billing may move to the API',
  );
}
const queue = createQueueClient({
  wakeUrl: `http://127.0.0.1:${config.wakePort}`,
  wakeSecret: config.wakeSecret,
  log,
});
const host = createHost({ config, queue, log });
const resumed = host.start();
const health = startHealthServer(config.port, host.health, log);
log('info', 'planner host started', {
  port: config.port,
  model: config.model,
  cwd: config.repoRoot,
  session: resumed ? 'resumed' : 'fresh',
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  log('info', 'planner host shutting down');
  host.stop();
  health.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
