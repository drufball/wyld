import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { EVENT_KINDS, WakeMessage, type WakeMessage as WakeMessageType } from '@wyld/shared';
import { z } from 'zod';

import type { LogContext, LogLevel } from './logger.js';

export type QueuedMessage = WakeMessageType & { id: number };
export type ChannelNotification = {
  method: 'notifications/claude/channel';
  params: { content: string; meta: Record<string, string> };
};
type Logger = (level: LogLevel, msg: string, context?: LogContext) => void;

export function createStreamLogger(stream: NodeJS.WritableStream): Logger {
  return (level, msg, context = {}) =>
    stream.write(`${JSON.stringify({ ts: new Date().toISOString(), level, msg, ...context })}\n`);
}

export const CHANNEL_INSTRUCTIONS = `Events arrive as <channel source="wake" kind="..." quest="..." issue="..." pr="..." url="..." ts="...">summary</channel>.
They are already normalised and sender-gated; act on them directly.
factory/planner/PROTOCOL.md defines each kind. Use the pak_* tools to write back to the Pak.`;

export function notificationFor(message: QueuedMessage): ChannelNotification {
  const meta: Record<string, string> = {
    kind: message.kind,
    ts: message.ts,
    source: message.source,
  };
  for (const key of ['quest', 'issue', 'pr', 'url'] as const) {
    const value = message[key];
    if (value !== undefined) meta[key] = String(value);
  }
  return { method: 'notifications/claude/channel', params: { content: message.summary, meta } };
}

export function createDeliveryLoop(options: {
  claim: () => Promise<QueuedMessage[]>;
  ack: (ids: number[]) => Promise<void>;
  emit: (notification: ChannelNotification) => Promise<void>;
  log: Logger;
  intervalMs?: number;
  maxBackoffMs?: number;
}) {
  const intervalMs = options.intervalMs ?? 2_000;
  const maxBackoffMs = options.maxBackoffMs ?? 30_000;
  let delay = intervalMs;
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  const tick = async (): Promise<void> => {
    try {
      const messages = (await options.claim()).sort(
        (left, right) => left.ts.localeCompare(right.ts) || left.id - right.id,
      );
      for (const message of messages) await options.emit(notificationFor(message));
      if (messages.length > 0) await options.ack(messages.map(({ id }) => id));
      delay = intervalMs;
    } catch (error) {
      options.log('debug', 'Wake channel delivery failed; retrying', {
        error: error instanceof Error ? error.message : String(error),
        retryMs: delay,
      });
      delay = Math.min(delay * 2, maxBackoffMs);
    }
  };

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => void run(), delay);
  };
  const run = async () => {
    await tick();
    schedule();
  };
  return {
    tick,
    start() {
      stopped = false;
      void run();
    },
    stop() {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}

const LogEventArgs = z.object({
  kind: z.string(),
  summary: z.string(),
  quest: z.string().optional(),
});
const NextActionArgs = z.object({ text: z.string(), deep_link: z.string().default('/') });

const tools = [
  {
    name: 'pak_log_event',
    description: 'Record a Planner event in the Pak event stream.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        kind: { type: 'string', description: 'A valid WYLD event kind.' },
        summary: { type: 'string', description: 'A concise event summary.' },
        quest: { type: 'string', description: 'Optional quest ID.' },
      },
      required: ['kind', 'summary'],
      additionalProperties: false,
    },
  },
  {
    name: 'pak_set_next_action',
    description: 'Set the next action displayed by the Pak presence UI.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The next action to display.' },
        deep_link: { type: 'string', description: 'Optional Pak deep link; defaults to /.' },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
];

function textResult(text: string, isError = false) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError: true } : {}) };
}

export function registerPakTools(
  server: Server,
  options: { pakUrl: string; fetch?: typeof fetch },
): void {
  const request = options.fetch ?? fetch;
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    if (params.name === 'pak_log_event') {
      const parsed = LogEventArgs.safeParse(params.arguments);
      if (!parsed.success)
        return textResult(`Invalid arguments: ${z.prettifyError(parsed.error)}`, true);
      if (!EVENT_KINDS.includes(parsed.data.kind as (typeof EVENT_KINDS)[number]))
        return textResult(`Invalid kind. Valid kinds: ${EVENT_KINDS.join(', ')}`, true);
      return postTool(request, `${options.pakUrl}/api/events`, {
        source: 'planner',
        kind: parsed.data.kind,
        payload: { summary: parsed.data.summary },
        ...(parsed.data.quest === undefined ? {} : { questId: parsed.data.quest }),
      });
    }
    if (params.name === 'pak_set_next_action') {
      const parsed = NextActionArgs.safeParse(params.arguments);
      if (!parsed.success)
        return textResult(`Invalid arguments: ${z.prettifyError(parsed.error)}`, true);
      return postTool(
        request,
        `${options.pakUrl}/api/presence/next-action`,
        { text: parsed.data.text, deepLink: parsed.data.deep_link },
        true,
      );
    }
    return textResult(`Unknown tool: ${params.name}`, true);
  });
}

async function postTool(
  request: typeof fetch,
  url: string,
  body: unknown,
  missingIsUnimplemented = false,
) {
  try {
    const response = await request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const responseBody = await response.text();
    if (!response.ok) {
      const detail =
        missingIsUnimplemented && response.status === 404
          ? 'The endpoint is not implemented yet.'
          : responseBody;
      return textResult(
        `HTTP ${response.status}: ${detail}${detail === responseBody ? '' : ` ${responseBody}`}`.trim(),
        true,
      );
    }
    return textResult(responseBody || 'OK');
  } catch (error) {
    return textResult(
      `HTTP request failed: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }
}

export function parseClaimResponse(value: unknown): QueuedMessage[] {
  return z
    .object({ messages: z.array(WakeMessage.extend({ id: z.number().int().positive() })) })
    .parse(value).messages;
}
