import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLogger } from '@wyld/shared';

import packageMetadata from '../package.json' with { type: 'json' };
import {
  CHANNEL_INSTRUCTIONS,
  createDaemonPost,
  createDeliveryLoop,
  parseClaimResponse,
  registerPakTools,
} from './channel.js';
import { createToolReloader } from './reload.js';

const wakePort = process.env.WAKE_PORT ?? '8788';
const wakeSecret = process.env.WAKE_SECRET ?? '';
const wakeUrl = `http://127.0.0.1:${wakePort}`;
const channelLog = createLogger(process.stderr);

const mcp = new Server(
  { name: 'wake', version: packageMetadata.version },
  {
    capabilities: { experimental: { 'claude/channel': {} }, tools: { listChanged: true } },
    instructions: CHANNEL_INSTRUCTIONS,
  },
);
const registerOptions = {
  pakUrl: process.env.PAK_URL ?? 'http://localhost:8787',
  logger: channelLog,
};
const registry = registerPakTools(mcp, registerOptions);
await mcp.connect(new StdioServerTransport());

const watching = path.dirname(fileURLToPath(import.meta.url));
const reloader = createToolReloader({
  moduleUrl: new URL('./channel.js', import.meta.url).href,
  registerOptions,
  swap: registry.swap,
  notify: () => mcp.sendToolListChanged(),
  log: channelLog,
});
reloader.watch(watching);
process.on('SIGHUP', () => void reloader.reload('SIGHUP'));
channelLog('info', 'wake channel hot reload armed', { pid: process.pid, watching });

// The Agent SDK host claims events itself; disabling push prevents two consumers racing.
const channelPush = !['0', 'false'].includes((process.env.WAKE_CHANNEL_PUSH ?? '').toLowerCase());
if (channelPush) {
  const daemonPost = createDaemonPost({ wakeUrl, wakeSecret, log: channelLog });
  createDeliveryLoop({
    claim: async () =>
      parseClaimResponse(
        await (await daemonPost('/queue/claim', { limit: 20 })).json(),
        channelLog,
      ),
    ack: async (ids) => void (await daemonPost('/queue/ack', { ids })),
    emit: async (notification) => void (await mcp.notification(notification)),
    log: channelLog,
  }).start();
} else {
  channelLog('info', 'wake channel push disabled');
}
