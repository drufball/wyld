import { describe, expect, it } from 'vitest';

import { normaliseEvent, normaliseGithub } from './normalise.js';

const now = new Date('2026-02-01T00:00:00.000Z');
const timestamp = '2026-01-01T00:00:00.000Z';
const item = {
  number: 14,
  title: 'Wake core',
  body: '<!-- quest:wake-14 -->',
  html_url: 'https://example.test/items/14',
  created_at: timestamp,
  updated_at: timestamp,
  closed_at: timestamp,
};

describe('normaliseGithub', () => {
  it.each([
    [
      'issues opened',
      'issues',
      { action: 'opened', issue: item },
      {
        source: 'github',
        kind: 'github.issue_opened',
        issue: 14,
        quest: 'wake-14',
        url: item.html_url,
        summary: 'Issue #14 opened: Wake core',
        ts: timestamp,
      },
    ],
    [
      'issues closed',
      'issues',
      { action: 'closed', issue: item },
      {
        source: 'github',
        kind: 'github.issue_closed',
        issue: 14,
        quest: 'wake-14',
        url: item.html_url,
        summary: 'Issue #14 closed: Wake core',
        ts: timestamp,
      },
    ],
    [
      'issue comment',
      'issue_comment',
      {
        action: 'created',
        issue: item,
        comment: {
          body: 'Looks good',
          html_url: 'https://example.test/comments/1',
          created_at: timestamp,
          user: { login: 'dru' },
        },
      },
      {
        source: 'github',
        kind: 'github.issue_comment',
        issue: 14,
        quest: 'wake-14',
        url: 'https://example.test/comments/1',
        summary: 'dru commented on #14: Looks good',
        ts: timestamp,
      },
    ],
    [
      'pull request opened',
      'pull_request',
      { action: 'opened', pull_request: item },
      {
        source: 'github',
        kind: 'github.pr_opened',
        pr: 14,
        quest: 'wake-14',
        url: item.html_url,
        summary: 'PR #14 opened: Wake core',
        ts: timestamp,
      },
    ],
    [
      'pull request reopened',
      'pull_request',
      { action: 'reopened', pull_request: item },
      {
        source: 'github',
        kind: 'github.pr_opened',
        pr: 14,
        quest: 'wake-14',
        url: item.html_url,
        summary: 'PR #14 opened: Wake core',
        ts: timestamp,
      },
    ],
    [
      'pull request synchronize',
      'pull_request',
      { action: 'synchronize', pull_request: item },
      {
        source: 'github',
        kind: 'github.pr_synced',
        pr: 14,
        quest: 'wake-14',
        url: item.html_url,
        summary: 'PR #14 updated',
        ts: timestamp,
      },
    ],
    [
      'pull request merged',
      'pull_request',
      { action: 'closed', pull_request: { ...item, merged: true } },
      {
        source: 'github',
        kind: 'github.pr_closed',
        pr: 14,
        quest: 'wake-14',
        url: item.html_url,
        summary: 'PR #14 merged',
        ts: timestamp,
      },
    ],
    [
      'pull request closed unmerged',
      'pull_request',
      { action: 'closed', pull_request: { ...item, merged: false } },
      {
        source: 'github',
        kind: 'github.pr_closed',
        pr: 14,
        quest: 'wake-14',
        url: item.html_url,
        summary: 'PR #14 closed without merging',
        ts: timestamp,
      },
    ],
    [
      'review approved',
      'pull_request_review',
      {
        action: 'submitted',
        pull_request: item,
        review: {
          state: 'approved',
          submitted_at: timestamp,
          html_url: 'https://example.test/reviews/1',
          user: { login: 'pat' },
        },
      },
      {
        source: 'github',
        kind: 'github.pr_review',
        pr: 14,
        quest: 'wake-14',
        url: 'https://example.test/reviews/1',
        summary: 'pat approved PR #14',
        ts: timestamp,
      },
    ],
    [
      'review changes requested',
      'pull_request_review',
      {
        action: 'submitted',
        pull_request: item,
        review: { state: 'changes_requested', submitted_at: timestamp, user: { login: 'pat' } },
      },
      {
        source: 'github',
        kind: 'github.pr_review',
        pr: 14,
        quest: 'wake-14',
        summary: 'pat requested changes on PR #14',
        ts: timestamp,
      },
    ],
    [
      'review commented',
      'pull_request_review',
      {
        action: 'submitted',
        pull_request: item,
        review: { state: 'commented', submitted_at: timestamp, user: { login: 'pat' } },
      },
      {
        source: 'github',
        kind: 'github.pr_review',
        pr: 14,
        quest: 'wake-14',
        summary: 'pat commented on PR #14',
        ts: timestamp,
      },
    ],
    [
      'check suite',
      'check_suite',
      {
        action: 'completed',
        check_suite: {
          conclusion: 'success',
          head_branch: 'feature',
          updated_at: timestamp,
          html_url: 'https://example.test/checks/1',
          pull_requests: [{ number: 14 }],
        },
        sender: { login: 'github-actions[bot]', type: 'Bot' },
      },
      {
        source: 'github',
        kind: 'github.ci_completed',
        pr: 14,
        url: 'https://example.test/checks/1',
        summary: 'CI success on feature',
        ts: timestamp,
      },
    ],
    [
      'workflow run',
      'workflow_run',
      {
        action: 'completed',
        workflow_run: {
          name: 'CI',
          conclusion: 'failure',
          head_branch: 'feature',
          updated_at: timestamp,
          html_url: 'https://example.test/runs/1',
          pull_requests: [{ number: 15 }],
        },
      },
      {
        source: 'github',
        kind: 'github.ci_completed',
        pr: 15,
        url: 'https://example.test/runs/1',
        summary: 'CI failure on feature',
        ts: timestamp,
      },
    ],
    [
      'push',
      'push',
      {
        ref: 'refs/heads/main',
        pusher: { name: 'dru' },
        commits: [{}, {}],
        compare: 'https://example.test/compare',
        head_commit: { timestamp },
      },
      {
        source: 'github',
        kind: 'github.push',
        url: 'https://example.test/compare',
        summary: 'dru pushed 2 commits to main',
        ts: timestamp,
      },
    ],
  ] as const)('normalises %s', (_name, eventType, payload, expected) => {
    expect(normaliseGithub(eventType, payload, now)).toEqual(expected);
  });

  it('omits quest when the marker is absent', () => {
    expect(
      normaliseGithub('issues', { action: 'opened', issue: { ...item, body: 'none' } }, now),
    ).toEqual({
      source: 'github',
      kind: 'github.issue_opened',
      issue: 14,
      url: item.html_url,
      summary: 'Issue #14 opened: Wake core',
      ts: timestamp,
    });
  });

  it('drops bot issue comments, unknown event types, and unhandled actions', () => {
    expect(
      normaliseGithub(
        'issue_comment',
        {
          action: 'created',
          issue: item,
          comment: { body: 'noise' },
          sender: { login: 'bot', type: 'Bot' },
        },
        now,
      ),
    ).toBeUndefined();
    expect(normaliseGithub('mystery', {}, now)).toBeUndefined();
    expect(normaliseGithub('issues', { action: 'edited', issue: item }, now)).toBeUndefined();
  });

  it('truncates GitHub summaries', () => {
    const result = normaliseGithub(
      'issues',
      { action: 'opened', issue: { ...item, title: 'x'.repeat(400) } },
      now,
    );
    expect(result!.summary.length).toBeLessThanOrEqual(280);
    expect(result?.summary.endsWith('…')).toBe(true);
  });
});

describe('sleep alarms', () => {
  const event = (alarm: string, trigger = 'schedule', payload = {}) => ({
    id: 1,
    ts: timestamp,
    source: 'sleep',
    kind: 'sleep.alarm',
    payload: {
      runId: 12,
      alarm,
      trigger,
      lightsOnAt: '2026-01-01T08:05:00.000Z',
      ...payload,
    },
  });

  it.each([
    ['goodnight', 'schedule', 'Goodnight — Sleep Mode started (scheduled); lights on at 08:05'],
    ['goodnight', 'human', 'Goodnight — Sleep Mode started (by Dru); lights on at 08:05'],
    ['last_call', 'schedule', 'Last call — lights on at 08:05, wrap up the night'],
    ['lights_on', 'schedule', 'Lights on — end the run and reset Today'],
  ])('normalises %s (%s)', (alarm, trigger, summary) => {
    expect(normaliseEvent(event(alarm, trigger))).toMatchObject({
      source: 'sleep',
      kind: 'sleep.alarm',
      run: 12,
      summary,
    });
  });

  it('drops bad alarms and every other sleep event', () => {
    expect(normaliseEvent(event('bad'))).toBeUndefined();
    expect(normaliseEvent({ ...event('goodnight'), kind: 'sleep.phase' })).toBeUndefined();
  });
});

describe('normaliseEvent', () => {
  it.each([
    [
      'human.question',
      { text: 'How does Wake work?', chainId: 7 },
      'wake-24',
      'Dru asks about wake-24: How does Wake work?',
    ],
    [
      'human.chain_closed',
      { text: 'Settled: how does Wake work', chainId: 8 },
      undefined,
      'Settled: how does Wake work',
    ],
  ] as const)('normalises %s with its chain id', (kind, payload, questId, summary) => {
    expect(
      normaliseEvent({ id: 1, ts: timestamp, source: 'human', kind, payload, questId }),
    ).toEqual({
      source: 'human',
      kind,
      summary,
      chain: payload.chainId,
      ...(questId === undefined ? {} : { quest: questId }),
      ts: timestamp,
    });
  });

  it.each([
    ['human.nudge', 'Keep moving', 'Nudge on wake-24: Keep moving'],
    ['human.ask', 'What is next?', 'Ask on wake-24: What is next?'],
    ['human.park', 'Park: Wake tools', 'Park: Wake tools'],
  ] as const)('routes %s to its quest', (kind, text, summary) => {
    expect(
      normaliseEvent({
        id: 1,
        ts: timestamp,
        source: 'human',
        kind,
        payload: { text },
        questId: 'wake-24',
      }),
    ).toEqual({ source: 'human', kind, summary, quest: 'wake-24', ts: timestamp });
  });

  it('still drops a text-less nudge', () => {
    expect(
      normaliseEvent({
        id: 1,
        ts: timestamp,
        source: 'human',
        kind: 'human.nudge',
        payload: {},
        questId: 'wake-24',
      }),
    ).toBeUndefined();
  });

  it('does not repeat the default nudge button text', () => {
    expect(
      normaliseEvent({
        id: 1,
        ts: timestamp,
        source: 'human',
        kind: 'human.nudge',
        payload: { text: '  NuDgE  ' },
        questId: 'wake-24',
      }),
    ).toEqual({
      source: 'human',
      kind: 'human.nudge',
      summary: 'Nudge on wake-24',
      quest: 'wake-24',
      ts: timestamp,
    });
  });
});
