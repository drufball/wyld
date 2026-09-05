import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import packageMetadata from '../package.json' with { type: 'json' };
import {
  CHANNEL_INSTRUCTIONS,
  createDeliveryLoop,
  createStreamLogger,
  parseClaimResponse,
  registerPakTools,
} from './channel.js';

const wakePort = process.env.WAKE_PORT ?? '8788';
const wakeSecret = process.env.WAKE_SECRET ?? '';
const wakeUrl = `http://127.0.0.1:${wakePort}`;
const channelLog = createStreamLogger(process.stderr);

const mcp = new Server(
  { name: 'wake', version: packageMetadata.version },
  {
    capabilities: { experimental: { 'claude/channel': {} }, tools: {} },
    instructions: CHANNEL_INSTRUCTIONS,
  },
);
registerPakTools(mcp, { pakUrl: process.env.PAK_URL ?? 'http://localhost:8787' });
await mcp.connect(new StdioServerTransport());

const daemonPost = async (path: string, body: unknown) => {
  const response = await fetch(`${wakeUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Wake-Secret': wakeSecret },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(`${path} returned HTTP ${response.status}: ${await response.text()}`);
  return response;
};

createDeliveryLoop({
  claim: async () =>
    parseClaimResponse(await (await daemonPost('/queue/claim', { limit: 20 })).json()),
  ack: async (ids) => void (await daemonPost('/queue/ack', { ids })),
  emit: async (notification) => void (await mcp.notification(notification)),
  log: channelLog,
}).start();
