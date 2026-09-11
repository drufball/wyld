import { readConfig } from './config.js';
import { createHeartbeat } from './heartbeat.js';
import { startHealthServer } from './health.js';
import { createHost } from './host.js';
import { log } from '@wyld/shared';
import { createQueueClient } from './queue.js';
import { scrubSecrets } from './scrub.js';

process.env.WAKE_CHANNEL_PUSH = '0';
const config = readConfig();
const scrubbed = scrubSecrets(process.env);
log('info', 'planner host environment scrubbed', { keys: Object.keys(scrubbed) });
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
const heartbeat = createHeartbeat({
  pakUrl: config.pakUrl,
  intervalSeconds: config.heartbeatSeconds,
  state: () => host.heartbeatState(),
  log,
});
const host = createHost({ config, queue, log, onSessionReady: () => heartbeat.start() });
const resumed = host.start();
const health = startHealthServer(config.port, host.health, log);
log('info', 'planner host started', {
  port: config.port,
  model: config.model,
  cwd: config.repoRoot,
  session: resumed ? 'resumed' : 'fresh',
  heartbeatSeconds: config.heartbeatSeconds,
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  log('info', 'planner host shutting down');
  host.stop();
  heartbeat.stop();
  health.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
