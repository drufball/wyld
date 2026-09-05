import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  CiState,
  type HealthReport,
  PlannerState,
  Quest,
  RumbleKind,
  WakeMessageWire,
  type WakeMessageWire as WakeMessageWireType,
} from '@wyld/shared';
import { z } from 'zod';

import type { LogContext, LogLevel } from './logger.js';

export type QueuedMessage = WakeMessageWireType & { id: number };
export type ChannelNotification = {
  method: 'notifications/claude/channel';
  params: { content: string; meta: Record<string, string> };
};
type Logger = (level: LogLevel, msg: string, context?: LogContext) => void;

export function createDaemonPost(options: {
  wakeUrl: string;
  wakeSecret: string;
  fetch?: typeof fetch;
  log: Logger;
}) {
  const request = options.fetch ?? fetch;
  let loggedUnauthorized = false;
  if (options.wakeSecret.length === 0)
    options.log('error', 'WAKE_SECRET is missing; Wake channel delivery cannot authenticate');
  return async (path: string, body: unknown) => {
    const response = await request(`${options.wakeUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Wake-Secret': options.wakeSecret },
      body: JSON.stringify(body),
    });
    const responseBody = response.ok ? '' : await response.text();
    if (response.status === 401 && !loggedUnauthorized) {
      loggedUnauthorized = true;
      options.log('error', 'Wake daemon rejected channel authentication', { path, status: 401 });
    }
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}: ${responseBody}`);
    return response;
  };
}

export function createStreamLogger(stream: NodeJS.WritableStream): Logger {
  return (level, msg, context = {}) =>
    stream.write(`${JSON.stringify({ ts: new Date().toISOString(), level, msg, ...context })}\n`);
}

export const CHANNEL_INSTRUCTIONS = `Events arrive as <channel source="wake" kind="..." quest="..." issue="..." pr="..." chain="..." url="..." ts="...">summary</channel>.
They are already normalised and sender-gated; act on them directly.
factory/planner/PROTOCOL.md defines each kind. Use the pak_* tools to write back to the Pak.`;

export function notificationFor(message: QueuedMessage): ChannelNotification {
  const meta: Record<string, string> = {
    kind: message.kind,
    ts: message.ts,
    source: message.source,
  };
  for (const key of ['quest', 'issue', 'pr', 'chain', 'url'] as const) {
    const value = message[key];
    if (value !== undefined) meta[key] = String(value);
  }
  return { method: 'notifications/claude/channel', params: { content: message.summary, meta } };
}

export function createDeliveryLoop(options: {
  claim: () => Promise<{ messages: QueuedMessage[]; dropped: number[] }>;
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
      const claim = await options.claim();
      const messages = claim.messages.sort(
        (left, right) => left.ts.localeCompare(right.ts) || left.id - right.id,
      );
      const emitted: number[] = [];
      for (const message of messages) {
        try {
          await options.emit(notificationFor(message));
          emitted.push(message.id);
        } catch (error) {
          const ids = [...emitted, ...claim.dropped];
          if (ids.length > 0) {
            try {
              await options.ack(ids);
            } catch {
              // Preserve the emission error, which is the reason delivery stopped.
            }
          }
          throw error;
        }
      }
      const ids = [...emitted, ...claim.dropped];
      if (ids.length > 0) await options.ack(ids);
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
const QuestStatus = Quest.shape.status;
const UpsertQuestArgs = z
  .object({
    id: z.string(),
    world: z.string(),
    title: z.string(),
    pitch: z.string(),
    status: QuestStatus.optional(),
    since_you_looked: z.string().optional(),
    last_note: z.string().optional(),
  })
  .strict();
const SetQuestStatusArgs = z.object({ quest: z.string(), status: QuestStatus }).strict();
const SetSinceYouLookedArgs = z.object({ quest: z.string(), text: z.string() }).strict();
const LinkIssueArgs = z
  .object({
    quest: z.string(),
    gh_kind: z.enum(['issue', 'pr', 'branch']),
    gh_ref: z.string(),
    state: z.string(),
  })
  .strict();
const QuestArg = z.object({ quest: z.string() }).strict();
const PostNoteArgs = z
  .object({
    quest: z.string(),
    text: z.string(),
  })
  .strict();
const ReadQuestsArgs = z
  .object({ world: z.string().optional(), status: QuestStatus.optional() })
  .strict();
const ReadEventsArgs = z
  .object({
    since: z.number().int().default(0),
    kinds: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  })
  .strict();
const CatchupLineArg = z
  .object({ text: z.string().min(1), deep_link: z.string().optional() })
  .strict();
const WriteCatchupArgs = z
  .object({
    rumbles: z.array(CatchupLineArg).default([]),
    demos: z.array(CatchupLineArg).default([]),
    shipped: z.array(CatchupLineArg).default([]),
    fyi: z.array(z.string().min(1)).default([]),
    from_event_id: z.number().int().min(0).optional(),
    to_event_id: z.number().int().min(0).optional(),
  })
  .strict();
const ReadCatchupArgs = z.object({}).strict();
const HealthReportArgs = z
  .object({
    planner_state: PlannerState,
    current_task: z.string().max(200).optional(),
    gh_rate_remaining: z.number().int().min(0).optional(),
    ci_state: CiState.optional(),
    cost_today: z.number().min(0).optional(),
    codex_prs_open: z.number().int().min(0).optional(),
    paused_reason: z.string().max(280).optional(),
  })
  .strict();
const ReadHealthArgs = z.object({}).strict();
const RequestRumbleArgs = z
  .object({
    title: z.string().min(1).max(120),
    context: z.string().min(1).max(400),
    options: z.array(z.string().min(1)).min(1).max(4),
    kind: RumbleKind,
    blocking_quests: z.array(z.string()).default([]),
    id: z.string().optional(),
    chosen: z.string().optional(),
  })
  .strict()
  .superRefine((rumble, context) => {
    if (rumble.chosen !== undefined && !rumble.options.includes(rumble.chosen)) {
      context.addIssue({
        code: 'custom',
        path: ['chosen'],
        message: `chosen must be one of: ${rumble.options.join(', ')}`,
      });
    }
  });
const ReadRumblesArgs = z.object({ status: z.enum(['open', 'decided']).optional() }).strict();
const RegisterDemoArgs = z
  .object({
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    ref: z.string(),
    quest: z.string().optional(),
    title: z.string().optional(),
  })
  .strict();
const ReadDemosArgs = z.object({}).strict();
const ReadFeedbackArgs = z.object({ demo: z.string().optional() }).strict();
const ReadChainsArgs = z.object({ quest: z.string().optional() }).strict();
const SendMessageArgs = z
  .object({ text: z.string().min(1), quest: z.string().optional() })
  .strict();
const AnswerChainArgs = z
  .object({ chain: z.number().int().positive(), text: z.string().min(1) })
  .strict();
const CloseChainArgs = z.object({ chain: z.number().int().positive() }).strict();

const statusSchema = { type: 'string' as const, enum: QuestStatus.options };

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
  {
    name: 'pak_upsert_quest',
    description:
      'Create a quest, or update its world, title or pitch. Omitted fields keep their current values.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' },
        world: { type: 'string' },
        title: { type: 'string' },
        pitch: { type: 'string' },
        status: statusSchema,
        since_you_looked: { type: 'string' },
        last_note: { type: 'string' },
      },
      required: ['id', 'world', 'title', 'pitch'],
      additionalProperties: false,
    },
  },
  {
    name: 'pak_set_quest_status',
    description:
      'Move a quest along the lifecycle (idea → planning → building → demo → done, or parked).',
    inputSchema: {
      type: 'object' as const,
      properties: { quest: { type: 'string' }, status: statusSchema },
      required: ['quest', 'status'],
      additionalProperties: false,
    },
  },
  {
    name: 'pak_set_since_you_looked',
    description:
      "Set a quest's one-sentence 'since you looked' line; refresh it after every batch of actions that touched the quest.",
    inputSchema: {
      type: 'object' as const,
      properties: { quest: { type: 'string' }, text: { type: 'string' } },
      required: ['quest', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'pak_link_issue',
    description:
      'Record a private GitHub issue/PR/branch against a quest so its progress bar stays honest. Never shown in the Pak.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        quest: { type: 'string' },
        gh_kind: { type: 'string', enum: ['issue', 'pr', 'branch'] },
        gh_ref: { type: 'string' },
        state: { type: 'string' },
      },
      required: ['quest', 'gh_kind', 'gh_ref', 'state'],
      additionalProperties: false,
    },
  },
  {
    name: 'pak_read_quest_links',
    description:
      'Read Planner-only private GitHub refs when coordinating a quest; never show returned refs in the Pak or write them into a note.',
    inputSchema: {
      type: 'object' as const,
      properties: { quest: { type: 'string' } },
      required: ['quest'],
      additionalProperties: false,
    },
  },
  {
    name: 'pak_post_note',
    description:
      'Write a plain-English note on a quest as the Planner; use it to answer a Nudge or an Ask in the same turn it arrives.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        quest: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['quest', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'pak_read_quests',
    description:
      'List quests with their current status, progress and notes; use it before planning to see what already exists.',
    inputSchema: {
      type: 'object' as const,
      properties: { world: { type: 'string' }, status: statusSchema },
      additionalProperties: false,
    },
  },
  {
    name: 'pak_read_events',
    description:
      'Read recent Pak events, newest last, optionally filtered by event-kind strings. Use it to pull intents and nudges when the channel is quiet.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        since: { type: 'integer', default: 0 },
        kinds: { type: 'array', items: { type: 'string' } },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'pak_write_catchup',
    description:
      "Write the Catch-Up briefing Dru sees when he returns: what's waiting, what shipped, and anything worth knowing. Plain English, no GitHub references.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        rumbles: {
          type: 'array',
          items: {
            type: 'object',
            properties: { text: { type: 'string', minLength: 1 }, deep_link: { type: 'string' } },
            required: ['text'],
            additionalProperties: false,
          },
          default: [],
        },
        demos: {
          type: 'array',
          items: {
            type: 'object',
            properties: { text: { type: 'string', minLength: 1 }, deep_link: { type: 'string' } },
            required: ['text'],
            additionalProperties: false,
          },
          default: [],
        },
        shipped: {
          type: 'array',
          items: {
            type: 'object',
            properties: { text: { type: 'string', minLength: 1 }, deep_link: { type: 'string' } },
            required: ['text'],
            additionalProperties: false,
          },
          default: [],
        },
        fyi: { type: 'array', items: { type: 'string', minLength: 1 }, default: [] },
        from_event_id: { type: 'integer', minimum: 0 },
        to_event_id: { type: 'integer', minimum: 0 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'pak_read_catchup',
    description:
      'Read the Catch-Up the Pak would show right now — whether it would show, how much has happened since Dru last looked, and the current digest. Use it before writing a better one.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'pak_health_report',
    description:
      'Send a heartbeat so the Debug Menu can show whether the factory is alive and what the Planner is doing right now. Send one every few minutes and after every batch of actions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        planner_state: { type: 'string', enum: PlannerState.options },
        current_task: { type: 'string', maxLength: 200 },
        gh_rate_remaining: { type: 'integer', minimum: 0 },
        ci_state: { type: 'string', enum: CiState.options },
        cost_today: { type: 'number', minimum: 0 },
        codex_prs_open: { type: 'integer', minimum: 0 },
        paused_reason: { type: 'string', maxLength: 280 },
      },
      required: ['planner_state'],
      additionalProperties: false,
    },
  },
  {
    name: 'pak_read_health',
    description:
      'Read the current factory health snapshot — Planner state, Wake queue, webhook feed, and server — so the Planner can answer "is everything up?" without shelling out.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'pak_request_rumble',
    description:
      'Raise a decision only Dru can make — accounts, money, model, taste, scope, or an outage — as a card on the Rumble screen. Give two sentences of context and 2–4 concrete options. For an account job Dru must do himself, put the exact steps in the context and give a single Done option. Rumbles never expire.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 120 },
        context: { type: 'string', minLength: 1, maxLength: 400 },
        options: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
          minItems: 1,
          maxItems: 4,
        },
        kind: { type: 'string', enum: RumbleKind.options },
        blocking_quests: { type: 'array', items: { type: 'string' }, default: [] },
        id: { type: 'string' },
        chosen: { type: 'string' },
      },
      required: ['title', 'context', 'options', 'kind'],
      additionalProperties: false,
    },
  },
  {
    name: 'pak_read_rumbles',
    description:
      'Read the decision cards and what Dru chose, so a human.decision event can be acted on and an open Rumble is not raised twice.',
    inputSchema: {
      type: 'object' as const,
      properties: { status: { type: 'string', enum: ['open', 'decided'] } },
      additionalProperties: false,
    },
  },
  {
    name: 'pak_register_demo',
    description:
      'Register a build Dru can try against a quest, or as the main build, and start building it. The slug becomes the URL. Registering a demo is what moves its quest to demo, and calling this again for the same slug rebuilds it.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: {
          type: 'string',
          pattern: '^[a-z0-9][a-z0-9-]{0,63}$',
          description: 'The URL segment, for example main or demo-discs.',
        },
        ref: { type: 'string', description: 'The git ref to build.' },
        quest: { type: 'string', description: 'The quest this demo belongs to.' },
        title: { type: 'string', description: 'An optional display label.' },
      },
      required: ['slug', 'ref'],
      additionalProperties: false,
    },
  },
  {
    name: 'pak_read_demos',
    description: 'Read the builds Dru can try right now and whether each one built cleanly.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'pak_read_feedback',
    description:
      'Read what Dru said about a Demo Disc, so a human.feedback event can be answered with the detail rather than just the summary line.',
    inputSchema: {
      type: 'object' as const,
      properties: { demo: { type: 'string', description: 'Optional Demo Disc slug.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'pak_read_chains',
    description:
      "Read the open chains — Dru's messages and yours, their chain ids, and the quest each one is about if any. Closed chains are never returned.",
    inputSchema: {
      type: 'object' as const,
      properties: { quest: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'pak_send_message',
    description:
      "Start a message to Dru in a new chain — an update, a heads-up, a question of your own. Give it a quest to attach it to one, or leave it off for an open message; either way it appears on Today as a card he can reply to. Plain English, two or three sentences. Use pak_answer_chain to reply inside a chain that already exists, and pak_post_note for a quest's own one-way line.",
    inputSchema: {
      type: 'object' as const,
      properties: { text: { type: 'string', minLength: 1 }, quest: { type: 'string' } },
      required: ['text'],
      additionalProperties: false,
    },
  },
  {
    name: 'pak_answer_chain',
    description:
      'Answer an open question chain in plain English, in the same turn the question arrives. Two or three sentences at most; no GitHub numbers, no status enums.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        chain: { type: 'integer', minimum: 1 },
        text: { type: 'string', minLength: 1 },
      },
      required: ['chain', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'pak_close_chain',
    description:
      'Settle a question chain once it is genuinely answered, so it folds away on Today. Dru can also settle it himself, and quiet chains settle on their own after a day.',
    inputSchema: {
      type: 'object' as const,
      properties: { chain: { type: 'integer', minimum: 1 } },
      required: ['chain'],
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
    if (params.name === 'pak_upsert_quest') {
      const parsed = UpsertQuestArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      const { world, since_you_looked, last_note, ...rest } = parsed.data;
      return postTool(request, `${options.pakUrl}/api/quests`, {
        ...rest,
        worldId: world,
        ...(since_you_looked === undefined ? {} : { sinceYouLooked: since_you_looked }),
        ...(last_note === undefined ? {} : { lastNote: last_note }),
      });
    }
    if (params.name === 'pak_set_quest_status') {
      const parsed = SetQuestStatusArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      return patchTool(request, questUrl(options.pakUrl, parsed.data.quest), {
        status: parsed.data.status,
        source: 'planner',
      });
    }
    if (params.name === 'pak_set_since_you_looked') {
      const parsed = SetSinceYouLookedArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      return patchTool(request, questUrl(options.pakUrl, parsed.data.quest), {
        sinceYouLooked: parsed.data.text,
        source: 'planner',
      });
    }
    if (params.name === 'pak_link_issue') {
      const parsed = LinkIssueArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      return postTool(request, `${questUrl(options.pakUrl, parsed.data.quest)}/links`, {
        ghKind: parsed.data.gh_kind,
        ghRef: parsed.data.gh_ref,
        state: parsed.data.state,
      });
    }
    if (params.name === 'pak_read_quest_links') {
      const parsed = QuestArg.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      return getTool(request, `${questUrl(options.pakUrl, parsed.data.quest)}/links`, {
        'X-Planner': '1',
      });
    }
    if (params.name === 'pak_post_note') {
      const parsed = PostNoteArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      return postTool(request, `${questUrl(options.pakUrl, parsed.data.quest)}/notes`, {
        text: parsed.data.text,
        author: 'planner',
      });
    }
    if (params.name === 'pak_read_quests') {
      const parsed = ReadQuestsArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      const query = new URLSearchParams();
      if (parsed.data.world !== undefined) query.set('world', parsed.data.world);
      if (parsed.data.status !== undefined) query.set('status', parsed.data.status);
      const suffix = query.size === 0 ? '' : `?${query.toString()}`;
      return getTool(request, `${options.pakUrl}/api/quests${suffix}`);
    }
    if (params.name === 'pak_read_events') {
      const parsed = ReadEventsArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      const response = await getTool(
        request,
        `${options.pakUrl}/api/events?${new URLSearchParams({ since: String(parsed.data.since), limit: '500' })}`,
      );
      if (response.isError) return response;
      try {
        const events = z
          .array(z.object({ kind: z.string() }).passthrough())
          .parse(JSON.parse(response.content[0]!.text));
        const selected = parsed.data.kinds
          ? events.filter(({ kind }) => parsed.data.kinds!.includes(kind))
          : events;
        return textResult(JSON.stringify(selected.slice(-parsed.data.limit)));
      } catch (error) {
        return textResult(
          `Invalid Pak response: ${error instanceof Error ? error.message : String(error)}`,
          true,
        );
      }
    }
    if (params.name === 'pak_write_catchup') {
      const parsed = WriteCatchupArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      const { from_event_id, to_event_id, ...digest } = parsed.data;
      const mapLines = (lines: z.infer<typeof CatchupLineArg>[]) =>
        lines.map(({ text, deep_link }) => ({
          text,
          ...(deep_link === undefined ? {} : { deepLink: deep_link }),
        }));
      return postTool(request, `${options.pakUrl}/api/catchup`, {
        digest: {
          rumbles: mapLines(digest.rumbles),
          demos: mapLines(digest.demos),
          shipped: mapLines(digest.shipped),
          fyi: digest.fyi,
        },
        ...(from_event_id === undefined ? {} : { fromEventId: from_event_id }),
        ...(to_event_id === undefined ? {} : { toEventId: to_event_id }),
      });
    }
    if (params.name === 'pak_read_catchup') {
      const parsed = ReadCatchupArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      return getTool(request, `${options.pakUrl}/api/catchup`);
    }
    if (params.name === 'pak_health_report') {
      const parsed = HealthReportArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      const {
        planner_state,
        current_task,
        gh_rate_remaining,
        ci_state,
        cost_today,
        codex_prs_open,
        paused_reason,
      } = parsed.data;
      const body: HealthReport = {
        plannerState: planner_state,
        ...(current_task === undefined ? {} : { currentTask: current_task }),
        ...(gh_rate_remaining === undefined ? {} : { ghRateRemaining: gh_rate_remaining }),
        ...(ci_state === undefined ? {} : { ciState: ci_state }),
        ...(cost_today === undefined ? {} : { costToday: cost_today }),
        ...(codex_prs_open === undefined ? {} : { codexPrsOpen: codex_prs_open }),
        ...(paused_reason === undefined ? {} : { pausedReason: paused_reason }),
      };
      return postTool(request, `${options.pakUrl}/api/health/report`, body);
    }
    if (params.name === 'pak_read_health') {
      const parsed = ReadHealthArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      return getTool(request, `${options.pakUrl}/api/health/snapshot`);
    }
    if (params.name === 'pak_request_rumble') {
      const parsed = RequestRumbleArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      const { blocking_quests, id, chosen, ...rumble } = parsed.data;
      return postTool(request, `${options.pakUrl}/api/rumbles`, {
        ...rumble,
        blockingQuestIds: blocking_quests,
        ...(id === undefined ? {} : { id }),
        ...(chosen === undefined ? {} : { chosen }),
      });
    }
    if (params.name === 'pak_read_rumbles') {
      const parsed = ReadRumblesArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      const suffix =
        parsed.data.status === undefined
          ? ''
          : `?${new URLSearchParams({ status: parsed.data.status }).toString()}`;
      return getTool(request, `${options.pakUrl}/api/rumbles${suffix}`);
    }
    if (params.name === 'pak_register_demo') {
      const parsed = RegisterDemoArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      return postTool(request, `${options.pakUrl}/api/demos`, {
        id: parsed.data.slug,
        ref: parsed.data.ref,
        ...(parsed.data.quest === undefined ? {} : { questId: parsed.data.quest }),
        ...(parsed.data.title === undefined ? {} : { title: parsed.data.title }),
      });
    }
    if (params.name === 'pak_read_demos') {
      const parsed = ReadDemosArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      return getTool(request, `${options.pakUrl}/api/demos`);
    }
    if (params.name === 'pak_read_feedback') {
      const parsed = ReadFeedbackArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      const suffix =
        parsed.data.demo === undefined
          ? ''
          : `?${new URLSearchParams({ demo: parsed.data.demo }).toString()}`;
      return getTool(request, `${options.pakUrl}/api/feedback${suffix}`);
    }
    if (params.name === 'pak_read_chains') {
      const parsed = ReadChainsArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      const suffix =
        parsed.data.quest === undefined
          ? ''
          : `?${new URLSearchParams({ quest: parsed.data.quest }).toString()}`;
      return getTool(request, `${options.pakUrl}/api/chains${suffix}`);
    }
    if (params.name === 'pak_send_message') {
      const parsed = SendMessageArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      return postTool(request, `${options.pakUrl}/api/chains`, {
        text: parsed.data.text,
        author: 'planner',
        ...(parsed.data.quest === undefined ? {} : { questId: parsed.data.quest }),
      });
    }
    if (params.name === 'pak_answer_chain') {
      const parsed = AnswerChainArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      return postTool(request, `${options.pakUrl}/api/chains/${parsed.data.chain}/messages`, {
        author: 'planner',
        text: parsed.data.text,
      });
    }
    if (params.name === 'pak_close_chain') {
      const parsed = CloseChainArgs.safeParse(params.arguments);
      if (!parsed.success) return invalidArguments(parsed.error);
      return postTool(request, `${options.pakUrl}/api/chains/${parsed.data.chain}/close`, {
        reason: 'settled',
        source: 'planner',
      });
    }
    return textResult(`Unknown tool: ${params.name}`, true);
  });
}

function invalidArguments(error: z.ZodError) {
  return textResult(`Invalid arguments: ${z.prettifyError(error)}`, true);
}

function questUrl(pakUrl: string, quest: string): string {
  return `${pakUrl}/api/quests/${encodeURIComponent(quest)}`;
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
      if (missingIsUnimplemented && response.status === 404) {
        const suffix = responseBody.length === 0 ? '' : ` ${responseBody}`;
        return textResult(
          `HTTP ${response.status}: The endpoint is not implemented yet.${suffix}`,
          true,
        );
      }
      return textResult(`HTTP ${response.status}: ${responseBody}`.trim(), true);
    }
    return textResult(responseBody || 'OK');
  } catch (error) {
    return textResult(
      `HTTP request failed: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }
}

async function patchTool(request: typeof fetch, url: string, body: unknown) {
  return requestTool(request, url, { method: 'PATCH', body });
}

async function getTool(request: typeof fetch, url: string, headers: Record<string, string> = {}) {
  return requestTool(request, url, { method: 'GET', headers });
}

async function requestTool(
  request: typeof fetch,
  url: string,
  options: { method: 'GET' | 'PATCH'; body?: unknown; headers?: Record<string, string> },
) {
  try {
    const headers =
      options.body === undefined
        ? (options.headers ?? {})
        : { 'content-type': 'application/json', ...(options.headers ?? {}) };
    const response = await request(url, {
      method: options.method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const responseBody = await response.text();
    if (!response.ok) return textResult(`HTTP ${response.status}: ${responseBody}`.trim(), true);
    return textResult(responseBody || 'OK');
  } catch (error) {
    return textResult(
      `HTTP request failed: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }
}

export function parseClaimResponse(
  value: unknown,
  log: Logger = () => undefined,
): { messages: QueuedMessage[]; dropped: number[] } {
  const envelope = z.object({ messages: z.array(z.unknown()) }).parse(value);
  const schema = WakeMessageWire.extend({ id: z.number().int().positive() });
  const messages: QueuedMessage[] = [];
  const dropped: number[] = [];
  for (const entry of envelope.messages) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) {
      messages.push(parsed.data);
      continue;
    }
    const id =
      typeof entry === 'object' &&
      entry !== null &&
      'id' in entry &&
      Number.isInteger(entry.id) &&
      Number(entry.id) > 0
        ? Number(entry.id)
        : undefined;
    const context = { error: parsed.error.message, ...(id === undefined ? {} : { id }) };
    if (id === undefined) {
      log('error', 'Wake channel dropped an unparseable message without a usable id', context);
    } else {
      log('warn', 'Wake channel dropped an unparseable message', context);
      dropped.push(id);
    }
  }
  return { messages, dropped };
}
