import { Event, WakeMessage, type WakeMessage as WakeMessageType } from '@wyld/shared';
import { z } from 'zod';

const QUEST = /<!--\s*quest:\s*([A-Za-z0-9_-]+)\s*-->/;
const User = z.object({ login: z.string(), type: z.string().optional() }).passthrough();
const PullRequestReference = z.object({ number: z.number().int().positive() }).passthrough();
const Item = z
  .object({
    number: z.number().int().positive(),
    title: z.string(),
    body: z.string().nullable().optional(),
    html_url: z.url().optional(),
    created_at: z.iso.datetime().optional(),
    updated_at: z.iso.datetime().optional(),
    closed_at: z.iso.datetime().nullable().optional(),
    merged_at: z.iso.datetime().nullable().optional(),
    merged: z.boolean().optional(),
  })
  .passthrough();
const Payload = z
  .object({
    action: z.string().optional(),
    sender: User.optional(),
    issue: Item.optional(),
    pull_request: Item.optional(),
    comment: z
      .object({
        body: z.string(),
        html_url: z.url().optional(),
        created_at: z.iso.datetime().optional(),
        user: User.optional(),
      })
      .passthrough()
      .optional(),
    review: z
      .object({
        state: z.string(),
        html_url: z.url().optional(),
        submitted_at: z.iso.datetime().optional(),
        user: User.optional(),
      })
      .passthrough()
      .optional(),
    check_suite: z
      .object({
        conclusion: z.string().nullable(),
        head_branch: z.string().nullable(),
        updated_at: z.iso.datetime().optional(),
        html_url: z.url().optional(),
        pull_requests: z.array(PullRequestReference).optional(),
      })
      .passthrough()
      .optional(),
    workflow_run: z
      .object({
        name: z.string(),
        conclusion: z.string().nullable(),
        head_branch: z.string(),
        updated_at: z.iso.datetime().optional(),
        html_url: z.url().optional(),
        pull_requests: z.array(PullRequestReference).optional(),
      })
      .passthrough()
      .optional(),
    ref: z.string().optional(),
    commits: z.array(z.unknown()).optional(),
    pusher: z.object({ name: z.string() }).passthrough().optional(),
    head_commit: z
      .object({ timestamp: z.iso.datetime().optional(), url: z.url().optional() })
      .passthrough()
      .nullable()
      .optional(),
    compare: z.url().optional(),
  })
  .passthrough();
const SleepAlarmPayload = z.object({
  alarm: z.enum(['goodnight', 'last_call', 'lights_on']),
  trigger: z.enum(['human', 'schedule']),
  runId: z.number().int().positive().nullable(),
  openRun: z.boolean().default(true),
  lightsOnAt: z.iso.datetime(),
});

function cleanLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
function truncate(value: string, maximum = 280): string {
  const line = cleanLine(value);
  if (line.length <= maximum) return line;
  const prefix = line.slice(0, maximum - 1);
  const boundary = prefix.lastIndexOf(' ');
  return `${prefix.slice(0, boundary > 0 ? boundary : maximum - 1).trimEnd()}…`;
}
function quest(body?: string | null): string | undefined {
  return body?.match(QUEST)?.[1];
}
function optional<T extends object>(key: string, value: unknown): T | object {
  return value === undefined || value === null ? {} : { [key]: value };
}
function githubMessage(
  input: Omit<WakeMessageType, 'source' | 'ts'>,
  timestamp: string | undefined,
  now: Date,
): WakeMessageType {
  return WakeMessage.parse({
    source: 'github',
    ts: timestamp ?? now.toISOString(),
    ...input,
    summary: truncate(input.summary),
  });
}

export function isBotGithubSender(raw: unknown): boolean {
  const parsed = Payload.safeParse(raw);
  return parsed.success && parsed.data.sender?.type?.toLowerCase() === 'bot';
}

export function normaliseGithub(
  eventType: string,
  raw: unknown,
  now = new Date(),
): WakeMessageType | undefined {
  const parsed = Payload.safeParse(raw);
  if (!parsed.success) return undefined;
  const p = parsed.data;
  if (eventType === 'issue_comment' && p.sender?.type?.toLowerCase() === 'bot') return undefined;
  if (eventType === 'issues' && (p.action === 'opened' || p.action === 'closed') && p.issue) {
    const i = p.issue;
    const opened = p.action === 'opened';
    return githubMessage(
      {
        kind: opened ? 'github.issue_opened' : 'github.issue_closed',
        issue: i.number,
        ...optional('quest', quest(i.body)),
        ...optional('url', i.html_url),
        summary: `Issue #${i.number} ${p.action}: ${cleanLine(i.title)}`,
      },
      opened ? i.created_at : (i.closed_at ?? i.updated_at),
      now,
    );
  }
  if (eventType === 'issue_comment' && p.action === 'created' && p.issue && p.comment) {
    const login = p.comment.user?.login ?? p.sender?.login;
    if (!login) return undefined;
    return githubMessage(
      {
        kind: 'github.issue_comment',
        issue: p.issue.number,
        ...optional('quest', quest(p.issue.body)),
        ...optional('url', p.comment.html_url),
        summary: `${login} commented on #${p.issue.number}: ${cleanLine(p.comment.body).slice(0, 140)}`,
      },
      p.comment.created_at,
      now,
    );
  }
  if (eventType === 'pull_request' && p.pull_request) {
    const pr = p.pull_request;
    const common = {
      pr: pr.number,
      ...optional('quest', quest(pr.body)),
      ...optional('url', pr.html_url),
    };
    if (p.action === 'opened' || p.action === 'reopened')
      return githubMessage(
        {
          kind: 'github.pr_opened',
          ...common,
          summary: `PR #${pr.number} opened: ${cleanLine(pr.title)}`,
        },
        pr.created_at ?? pr.updated_at,
        now,
      );
    if (p.action === 'synchronize')
      return githubMessage(
        { kind: 'github.pr_synced', ...common, summary: `PR #${pr.number} updated` },
        pr.updated_at,
        now,
      );
    if (p.action === 'closed')
      return githubMessage(
        {
          kind: 'github.pr_closed',
          ...common,
          summary:
            pr.merged || pr.merged_at
              ? `PR #${pr.number} merged`
              : `PR #${pr.number} closed without merging`,
        },
        pr.closed_at ?? pr.updated_at,
        now,
      );
  }
  if (
    eventType === 'pull_request_review' &&
    p.action === 'submitted' &&
    p.pull_request &&
    p.review
  ) {
    const login = p.review.user?.login ?? p.sender?.login;
    if (!login) return undefined;
    const wording =
      p.review.state.toLowerCase() === 'approved'
        ? 'approved'
        : p.review.state.toLowerCase() === 'changes_requested'
          ? 'requested changes on'
          : 'commented on';
    return githubMessage(
      {
        kind: 'github.pr_review',
        pr: p.pull_request.number,
        ...optional('quest', quest(p.pull_request.body)),
        ...optional('url', p.review.html_url),
        summary: `${login} ${wording} PR #${p.pull_request.number}`,
      },
      p.review.submitted_at,
      now,
    );
  }
  if (eventType === 'check_suite' && p.action === 'completed' && p.check_suite) {
    const c = p.check_suite;
    return githubMessage(
      {
        kind: 'github.ci_completed',
        ...optional('pr', c.pull_requests?.[0]?.number),
        ...optional('url', c.html_url),
        summary: `CI ${c.conclusion ?? 'unknown'} on ${c.head_branch ?? 'unknown'}`,
      },
      c.updated_at,
      now,
    );
  }
  if (eventType === 'workflow_run' && p.action === 'completed' && p.workflow_run) {
    const w = p.workflow_run;
    return githubMessage(
      {
        kind: 'github.ci_completed',
        ...optional('pr', w.pull_requests?.[0]?.number),
        ...optional('url', w.html_url),
        summary: `${w.name} ${w.conclusion ?? 'unknown'} on ${w.head_branch}`,
      },
      w.updated_at,
      now,
    );
  }
  if (eventType === 'push' && p.ref && p.pusher && p.commits) {
    const branch = p.ref.replace(/^refs\/heads\//, '');
    const n = p.commits.length;
    return githubMessage(
      {
        kind: 'github.push',
        ...optional('url', p.compare ?? p.head_commit?.url),
        summary: `${p.pusher.name} pushed ${n} commit${n === 1 ? '' : 's'} to ${branch}`,
      },
      p.head_commit?.timestamp,
      now,
    );
  }
  return undefined;
}

export function normaliseEvent(raw: unknown): WakeMessageType | undefined {
  const parsed = Event.safeParse(raw);
  if (!parsed.success) return undefined;
  const event = parsed.data;
  if (event.source === 'planner' && event.kind === 'planner.tick') {
    return WakeMessage.parse({
      source: event.source,
      kind: event.kind,
      summary: 'Hourly tick — check open work and keep the Pak fresh',
      ts: event.ts,
    });
  }
  if (event.source === 'sleep' && event.kind === 'sleep.alarm') {
    const alarm = SleepAlarmPayload.safeParse(event.payload);
    if (!alarm.success) return undefined;
    const time = new Date(alarm.data.lightsOnAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const summary =
      alarm.data.alarm === 'goodnight'
        ? `Goodnight — Sleep Mode started (${alarm.data.trigger === 'schedule' ? 'scheduled' : 'by Dru'}); lights on at ${time}`
        : alarm.data.alarm === 'last_call'
          ? `Last call — lights on at ${time}, wrap up the night`
          : alarm.data.openRun
            ? 'Lights on — end the run and reset Today'
            : 'Lights on — the run already ended; reset Today';
    return WakeMessage.parse({
      source: event.source,
      kind: event.kind,
      ...optional('run', alarm.data.runId),
      summary,
      ts: event.ts,
    });
  }
  if (event.source !== 'human' || event.kind === 'human.seen') return undefined;
  const text = event.payload['text'] ?? event.payload['summary'];
  if (typeof text !== 'string' || cleanLine(text).length === 0) return undefined;
  let summary: string;
  if (event.kind === 'human.intent') summary = `Dru: ${text}`;
  else if (event.kind === 'human.feedback')
    summary = `Feedback on ${typeof event.payload['demo'] === 'string' ? event.payload['demo'] : 'a demo'}: ${text}`;
  else if (event.kind === 'human.decision') summary = `Decision: ${text}`;
  else if (event.kind === 'human.nudge')
    summary = `Nudge on ${event.questId ?? 'a quest'}${cleanLine(text).toLowerCase() === 'nudge' ? '' : `: ${text}`}`;
  else if (event.kind === 'human.ask') summary = `Ask on ${event.questId ?? 'a quest'}: ${text}`;
  else if (event.kind === 'human.park') summary = text;
  else if (event.kind === 'human.question')
    summary = event.questId ? `Dru asks about ${event.questId}: ${text}` : `Dru asks: ${text}`;
  else if (event.kind === 'human.chain_closed') summary = text;
  else return undefined;
  const url = z.url().safeParse(event.payload['url']);
  const chain = z.number().int().positive().safeParse(event.payload['chainId']);
  return WakeMessage.parse({
    source: event.source,
    kind: event.kind,
    ...optional('quest', event.questId),
    ...(chain.success ? optional('chain', chain.data) : {}),
    ...(url.success ? { url: url.data } : {}),
    summary: truncate(summary),
    ts: event.ts,
  });
}

export { truncate as truncateSummary };
