import { createHmac } from 'node:crypto';

import { z } from 'zod';

export const HUMAN_KINDS = ['human.intent', 'human.feedback', 'human.decision'] as const;
export const GITHUB_KINDS = [
  'github.issue_opened',
  'github.issue_closed',
  'github.issue_comment',
  'github.pr_opened',
  'github.pr_synced',
  'github.pr_closed',
  'github.pr_review',
  'github.ci_completed',
  'github.push',
] as const;
export const SLEEP_KINDS = ['sleep.alarm'] as const;
export const SUPPORTED_DEV_KINDS = [...HUMAN_KINDS, ...GITHUB_KINDS, ...SLEEP_KINDS] as const;

export const DevEventInput = z.object({
  kind: z.string().optional(),
  summary: z.string().min(1).optional(),
  pr: z.number().int().positive().optional(),
  issue: z.number().int().positive().optional(),
  quest: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
});
export type DevEventInput = z.infer<typeof DevEventInput>;

type DevRequest = { path: '/event' | '/gh'; headers: Record<string, string>; body: string };

function githubItem(input: DevEventInput, number: number) {
  return {
    number,
    title: input.title ?? 'Test event',
    body: input.quest === undefined ? '' : `<!-- quest:${input.quest} -->`,
    html_url: `https://github.test/wyld/${number}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    closed_at: new Date().toISOString(),
  };
}

function githubFixture(kind: (typeof GITHUB_KINDS)[number], input: DevEventInput) {
  const issue = input.issue ?? input.pr ?? 1;
  const pr = input.pr ?? input.issue ?? 1;
  const issueItem = githubItem(input, issue);
  const prItem = githubItem(input, pr);
  switch (kind) {
    case 'github.issue_opened':
      return { event: 'issues', payload: { action: 'opened', issue: issueItem } };
    case 'github.issue_closed':
      return { event: 'issues', payload: { action: 'closed', issue: issueItem } };
    case 'github.issue_comment':
      return {
        event: 'issue_comment',
        payload: {
          action: 'created',
          issue: issueItem,
          comment: {
            body: input.summary ?? 'Test comment',
            html_url: `https://github.test/wyld/issues/${issue}#issuecomment-1`,
            created_at: new Date().toISOString(),
            user: { login: 'dev-emit' },
          },
        },
      };
    case 'github.pr_opened':
      return { event: 'pull_request', payload: { action: 'opened', pull_request: prItem } };
    case 'github.pr_synced':
      return { event: 'pull_request', payload: { action: 'synchronize', pull_request: prItem } };
    case 'github.pr_closed':
      return {
        event: 'pull_request',
        payload: { action: 'closed', pull_request: { ...prItem, merged: false } },
      };
    case 'github.pr_review':
      return {
        event: 'pull_request_review',
        payload: {
          action: 'submitted',
          pull_request: prItem,
          review: {
            state: 'approved',
            submitted_at: new Date().toISOString(),
            user: { login: 'dev-emit' },
          },
        },
      };
    case 'github.ci_completed':
      return {
        event: 'check_suite',
        payload: {
          action: 'completed',
          check_suite: {
            conclusion: 'success',
            head_branch: 'dev-emit',
            updated_at: new Date().toISOString(),
            pull_requests: [{ number: pr }],
          },
        },
      };
    case 'github.push':
      return {
        event: 'push',
        payload: {
          ref: 'refs/heads/dev-emit',
          pusher: { name: 'dev-emit' },
          commits: [{}],
          head_commit: { timestamp: new Date().toISOString() },
        },
      };
  }
}

export function buildDevRequest(
  input: DevEventInput,
  secrets: { wakeSecret: string; githubWebhookSecret?: string },
): DevRequest {
  const kind = input.kind ?? 'human.intent';
  if (!SUPPORTED_DEV_KINDS.includes(kind as (typeof SUPPORTED_DEV_KINDS)[number])) {
    throw new Error(
      `Unsupported kind "${kind}". Supported kinds: ${SUPPORTED_DEV_KINDS.join(', ')}`,
    );
  }
  if ((HUMAN_KINDS as readonly string[]).includes(kind)) {
    if (input.summary === undefined) throw new Error(`${kind} requires a summary`);
    return {
      path: '/event',
      headers: { 'content-type': 'application/json', 'X-Wake-Secret': secrets.wakeSecret },
      body: JSON.stringify({
        id: Date.now(),
        ts: new Date().toISOString(),
        source: 'human',
        kind,
        payload: { summary: input.summary },
      }),
    };
  }
  if ((SLEEP_KINDS as readonly string[]).includes(kind)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    return {
      path: '/event',
      headers: { 'content-type': 'application/json', 'X-Wake-Secret': secrets.wakeSecret },
      body: JSON.stringify({
        id: Date.now(),
        ts: new Date().toISOString(),
        source: 'sleep',
        kind,
        payload: {
          runId: 1,
          alarm: 'goodnight',
          trigger: 'schedule',
          lightsOnAt: tomorrow.toISOString(),
        },
      }),
    };
  }
  if (!secrets.githubWebhookSecret)
    throw new Error('GH_WEBHOOK_SECRET is required to emit GitHub events');
  const fixture = githubFixture(kind as (typeof GITHUB_KINDS)[number], input);
  const body = JSON.stringify(fixture.payload);
  const signature = createHmac('sha256', secrets.githubWebhookSecret).update(body).digest('hex');
  return {
    path: '/gh',
    headers: {
      'content-type': 'application/json',
      'X-GitHub-Event': fixture.event,
      'X-Hub-Signature-256': `sha256=${signature}`,
    },
    body,
  };
}
