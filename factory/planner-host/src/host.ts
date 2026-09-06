import fs from 'node:fs';
import path from 'node:path';

import {
  query as sdkQuery,
  type Options,
  type Query,
  type SDKMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import type { Config } from './config.js';
import { renderBatch } from './framing.js';
import { createInputQueue } from './input-queue.js';
import type { Logger } from './logger.js';
import type { QueuedMessage, QueueClient } from './queue.js';

export const DEFAULT_FIRST_MESSAGE =
  "This is a fresh Planner session started by the planner host; the previous session's context is gone. Read `factory/planner/STATE.md` first, then `factory/planner/PROTOCOL.md`, then carry on from there. Events will arrive as `<channel …>` tags in later messages.";
const Session = z.object({ sessionId: z.string().min(1), updatedAt: z.string() });
type Timer = ReturnType<typeof setTimeout>;
type QueryFunction = (parameters: {
  prompt: AsyncIterable<import('@anthropic-ai/claude-agent-sdk').SDKUserMessage>;
  options: Options;
}) => Query;

export type HostDependencies = {
  config: Config;
  queue: Pick<QueueClient, 'claim' | 'ack'>;
  log: Logger;
  query?: QueryFunction;
  readSession?: () => string | null;
  writeSession?: (id: string | null) => void;
  now?: () => number;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
  adapterExists?: (file: string) => boolean;
};

export function createHost(deps: HostDependencies) {
  const now = deps.now ?? Date.now;
  const schedule = deps.setTimeout ?? setTimeout;
  const unschedule = deps.clearTimeout ?? clearTimeout;
  const query = deps.query ?? sdkQuery;
  const exists = deps.adapterExists ?? fs.existsSync;
  const readSession =
    deps.readSession ??
    (() => {
      try {
        return Session.parse(JSON.parse(fs.readFileSync(deps.config.sessionFilePath, 'utf8')))
          .sessionId;
      } catch {
        return null;
      }
    });
  const writeSession =
    deps.writeSession ??
    ((id) => {
      try {
        if (id === null) {
          fs.rmSync(deps.config.sessionFilePath, { force: true });
          return;
        }
        fs.mkdirSync(deps.config.factoryDir, { recursive: true });
        fs.writeFileSync(
          deps.config.sessionFilePath,
          JSON.stringify({ sessionId: id, updatedAt: new Date(now()).toISOString() }),
        );
      } catch (error) {
        deps.log('warn', 'planner session file write failed', { error: String(error) });
      }
    });
  let pending: QueuedMessage[] = [];
  let inFlight: QueuedMessage[] = [];
  const knownIds = new Set<number>();
  let turnInFlight = false;
  let sessionId = readSession();
  let lastTurnAt: string | null = null;
  let lastMessageAt = now();
  let queueDepthSeen = 0;
  let restarts = 0;
  let backoffMs = 1_000;
  let claimDelay = deps.config.pollMs;
  let claimTimer: Timer | undefined;
  let watchdogTimer: Timer | undefined;
  let input = createInputQueue();
  let abort: AbortController | undefined;
  let stopped = false;
  let restarting = false;

  const compose = () => {
    if (turnInFlight || pending.length === 0) return;
    const batch = pending;
    pending = [];
    inFlight = batch;
    turnInFlight = true;
    input.push(renderBatch(batch));
    deps.log('info', 'planner turn queued', {
      size: batch.length,
      kinds: batch.map((m) => m.kind),
    });
  };
  const claimTick = async () => {
    if (stopped) return;
    try {
      const claimed = await deps.queue.claim(20);
      queueDepthSeen = claimed.messages.length;
      await deps.queue.ack(claimed.dropped);
      for (const message of claimed.messages)
        if (!knownIds.has(message.id)) {
          knownIds.add(message.id);
          pending.push(message);
        }
      claimDelay = deps.config.pollMs;
      compose();
    } catch (error) {
      deps.log('debug', 'planner queue claim failed; retrying', {
        error: String(error),
        retryMs: claimDelay,
      });
      claimDelay = Math.min(claimDelay * 2, 30_000);
    }
    claimTimer = schedule(() => void claimTick(), claimDelay);
  };
  const options = (resume: string | null, controller: AbortController): Options => {
    const adapter = path.join(deps.config.repoRoot, 'factory/wake/dist/channel-main.js');
    if (!exists(adapter))
      throw new Error(`Wake adapter not found at ${adapter}; run pnpm --filter @wyld/wake build`);
    const result: Options = {
      cwd: deps.config.repoRoot,
      model: deps.config.model,
      settingSources: ['project'],
      permissionMode: 'bypassPermissions',
      allowedTools: [
        'Bash',
        'Read',
        'Write',
        'Edit',
        'Glob',
        'Grep',
        'Agent',
        'Task',
        'WebFetch',
        'WebSearch',
        'ToolSearch',
        'TodoWrite',
        'mcp__wake__*',
      ],
      mcpServers: {
        wake: {
          command: process.execPath,
          args: [adapter],
          env: {
            WAKE_PORT: String(deps.config.wakePort),
            WAKE_SECRET: deps.config.wakeSecret,
            PAK_URL: deps.config.pakUrl,
            WAKE_CHANNEL_PUSH: '0',
          },
        },
      },
      abortController: controller,
      stderr: true as unknown as (data: string) => void,
      ...(resume === null ? {} : { resume }),
      ...(deps.config.maxTurns === undefined ? {} : { maxTurns: deps.config.maxTurns }),
      ...(deps.config.claudePath === undefined
        ? {}
        : { pathToClaudeCodeExecutable: deps.config.claudePath }),
    };
    return result;
  };
  const restart = async (reason: string) => {
    if (stopped || restarting) return;
    restarting = true;
    abort?.abort();
    input.close();
    pending = [...inFlight, ...pending];
    inFlight = [];
    turnInFlight = false;
    restarts++;
    const delay = backoffMs;
    backoffMs = Math.min(backoffMs * 2, 300_000);
    deps.log('warn', 'planner query restarting', { reason, retryMs: delay, restarts });
    await new Promise<void>((resolve) => schedule(resolve, delay));
    if (!stopped) {
      restarting = false;
      startQuery();
    }
  };
  const consume = async (stream: Query, resumed: boolean) => {
    let sawInit = false;
    try {
      for await (const raw of stream) {
        const message = raw as SDKMessage;
        lastMessageAt = now();
        if (message.type === 'system' && message.subtype === 'init') {
          sawInit = true;
          sessionId = message.session_id;
          writeSession(sessionId);
          deps.log('info', 'planner query initialized', {
            sessionId,
            mcpServers: message.mcp_servers.map((s) => ({ name: s.name, status: s.status })),
            toolCount: message.tools.length,
          });
          const wake = message.mcp_servers.find((server) => server.name === 'wake');
          if (wake?.status !== 'connected')
            deps.log('error', 'wake MCP server is not connected', {
              status: wake?.status ?? 'missing',
            });
        }
        if (message.type === 'result') {
          if (resumed && !sawInit) {
            writeSession(null);
            sessionId = null;
            pending = [...inFlight, ...pending];
            inFlight = [];
            turnInFlight = false;
            deps.log('warn', 'planner session resume failed; starting fresh');
            abort?.abort();
            input.close();
            restarting = true;
            schedule(() => {
              restarting = false;
              startQuery();
            }, 0);
            return;
          }
          await deps.queue.ack(inFlight.map((item) => item.id));
          for (const item of inFlight) knownIds.delete(item.id);
          inFlight = [];
          turnInFlight = false;
          lastTurnAt = new Date(now()).toISOString();
          backoffMs = 1_000;
          deps.log('info', 'planner turn completed', {
            subtype: message.subtype,
            isError: message.is_error,
            numTurns: message.num_turns,
          });
          compose();
        }
      }
      if (!stopped && !restarting) await restart('query ended');
    } catch (error) {
      if (!stopped && !restarting) await restart(`query failed: ${String(error)}`);
    }
  };
  const startQuery = () => {
    input = createInputQueue();
    abort = new AbortController();
    const resumed = sessionId !== null;
    if (!resumed) {
      input.push(deps.config.firstMessage ?? DEFAULT_FIRST_MESSAGE);
      turnInFlight = true;
    }
    const stream = query({ prompt: input, options: options(sessionId, abort) });
    void consume(stream, resumed);
    compose();
  };
  const watchdog = () => {
    if (
      !stopped &&
      (pending.length > 0 || turnInFlight) &&
      now() - lastMessageAt > deps.config.idleTimeoutMs
    )
      void restart('idle timeout');
    watchdogTimer = schedule(watchdog, Math.min(deps.config.pollMs, deps.config.idleTimeoutMs));
  };
  return {
    start() {
      startQuery();
      void claimTick();
      watchdog();
      return sessionId !== null;
    },
    stop() {
      stopped = true;
      abort?.abort();
      input.close();
      if (claimTimer) unschedule(claimTimer);
      if (watchdogTimer) unschedule(watchdogTimer);
    },
    health() {
      return { sessionId, lastTurnAt, queueDepthSeen, restarts };
    },
    tick: claimTick,
  };
}
