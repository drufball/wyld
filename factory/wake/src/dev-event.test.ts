import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { buildDevRequest, SUPPORTED_DEV_KINDS } from './dev-event.js';
import { normaliseEvent, normaliseGithub } from './normalise.js';

describe('buildDevRequest', () => {
  it('honours human kinds without adding requestedKind', () => {
    const request = buildDevRequest(
      { kind: 'human.feedback', summary: 'Please inspect the queue' },
      { wakeSecret: 'wake' },
    );
    expect(request.path).toBe('/event');
    expect(request.headers['X-Wake-Secret']).toBe('wake');
    const event = JSON.parse(request.body) as unknown;
    expect(event).not.toHaveProperty('payload.requestedKind');
    expect(normaliseEvent(event)).toMatchObject({
      source: 'human',
      kind: 'human.feedback',
      summary: 'Feedback on a demo: Please inspect the queue',
    });
  });

  it('builds and signs a GitHub fixture over the exact request bytes', () => {
    const request = buildDevRequest(
      { kind: 'github.pr_opened', pr: 99, quest: 'wake', title: 'test' },
      { wakeSecret: 'wake', githubWebhookSecret: 'github' },
    );
    expect(request.path).toBe('/gh');
    expect(request.headers['X-GitHub-Event']).toBe('pull_request');
    expect(request.headers['X-Hub-Signature-256']).toBe(
      `sha256=${createHmac('sha256', 'github').update(request.body).digest('hex')}`,
    );
    expect(
      normaliseGithub(request.headers['X-GitHub-Event']!, JSON.parse(request.body) as unknown),
    ).toMatchObject({
      source: 'github',
      kind: 'github.pr_opened',
      pr: 99,
      quest: 'wake',
      summary: 'PR #99 opened: test',
    });
  });

  it('rejects unsupported kinds and lists every supported kind', () => {
    expect(() => buildDevRequest({ kind: 'github.nope' }, { wakeSecret: 'wake' })).toThrow(
      `Supported kinds: ${SUPPORTED_DEV_KINDS.join(', ')}`,
    );
  });

  it('requires the GitHub webhook secret for GitHub fixtures', () => {
    expect(() => buildDevRequest({ kind: 'github.push' }, { wakeSecret: 'wake' })).toThrow(
      'GH_WEBHOOK_SECRET is required',
    );
  });
});
