import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { z } from 'zod';

import { log } from './logger.js';

const execFileAsync = promisify(execFile);

export type CommandRunner = (command: string, args: string[]) => Promise<string>;

export const runCommand: CommandRunner = async (command, args) => {
  const { stdout } = await execFileAsync(command, args, { timeout: 20_000 });
  return stdout;
};

const Runs = z.array(
  z.object({ status: z.string(), conclusion: z.string().nullable(), workflowName: z.string() }),
);
const PullRequest = z.object({
  number: z.number(),
  headRefName: z.string(),
  isDraft: z.boolean(),
});
const PullRequests = z.array(
  PullRequest.extend({
    createdAt: z.string(),
    statusCheckRollup: z.array(
      z.object({
        __typename: z.string(),
        name: z.string().optional(),
        status: z.string(),
        conclusion: z.string().nullable().optional(),
      }),
    ),
  }),
);
const PullRequestsWithoutChecks = z.array(
  z.object({
    number: z.number(),
    headRefName: z.string(),
    isDraft: z.boolean(),
  }),
);
const RateLimit = z.object({
  resources: z.object({ core: z.object({ remaining: z.number(), limit: z.number() }) }),
});

type State = 'pass' | 'fail' | 'pending' | 'unknown';
export type GithubStatus = {
  ciState: State;
  ciDetail: string;
  codexPrsOpen?: number;
  ghRateRemaining?: number;
  ghRateLimit?: number;
};

function reportReadError(source: string, error: unknown): void {
  log('error', 'github measurement failed', {
    source,
    error: error instanceof Error ? error.message : String(error),
  });
}

export async function readGithubStatus(
  repo: string,
  run: CommandRunner = runCommand,
  now: Date = new Date(),
): Promise<GithubStatus> {
  const calls = await Promise.allSettled([
    run('gh', [
      'run',
      'list',
      '--repo',
      repo,
      '--branch',
      'main',
      '--limit',
      '1',
      '--json',
      'status,conclusion,workflowName',
    ]),
    run('gh', [
      'pr',
      'list',
      '--repo',
      repo,
      '--state',
      'open',
      '--limit',
      '50',
      '--json',
      'number,headRefName,isDraft,createdAt,statusCheckRollup',
    ]),
    run('gh', ['api', 'rate_limit']),
  ]);

  let main: State = 'unknown';
  let robots: z.infer<typeof PullRequests> | undefined;
  let robotCount: number | undefined;
  let robotChecksMeasured = false;
  let rate: z.infer<typeof RateLimit> | undefined;
  try {
    if (calls[0].status === 'rejected') throw calls[0].reason;
    const latest = Runs.parse(JSON.parse(calls[0].value))[0];
    if (latest)
      main =
        latest.status !== 'completed'
          ? 'pending'
          : latest.conclusion === 'success'
            ? 'pass'
            : 'fail';
  } catch (error) {
    reportReadError('runs', error);
  }
  try {
    if (calls[1].status === 'rejected') throw calls[1].reason;
    robots = PullRequests.parse(JSON.parse(calls[1].value)).filter((pr) =>
      pr.headRefName.startsWith('codex/'),
    );
    robotCount = robots.length;
    robotChecksMeasured = true;
  } catch (error) {
    reportReadError('pull requests', error);
    try {
      const fallback = await run('gh', [
        'pr',
        'list',
        '--repo',
        repo,
        '--state',
        'open',
        '--limit',
        '50',
        '--json',
        'number,headRefName,isDraft',
      ]);
      robotCount = PullRequestsWithoutChecks.parse(JSON.parse(fallback)).filter((pr) =>
        pr.headRefName.startsWith('codex/'),
      ).length;
    } catch (fallbackError) {
      reportReadError('pull requests fallback', fallbackError);
    }
  }
  try {
    if (calls[2].status === 'rejected') throw calls[2].reason;
    rate = RateLimit.parse(JSON.parse(calls[2].value));
  } catch (error) {
    reportReadError('rate limit', error);
  }

  const robotStates = robots?.map<State>((pr) => {
    if (pr.statusCheckRollup.length === 0) {
      const createdAt = new Date(pr.createdAt);
      return !Number.isNaN(createdAt.getTime()) && now.getTime() - createdAt.getTime() < 5 * 60_000
        ? 'pending'
        : 'fail';
    }
    if (pr.statusCheckRollup.some((check) => check.status !== 'COMPLETED')) return 'pending';
    return pr.statusCheckRollup.some((check) =>
      ['FAILURE', 'TIMED_OUT', 'CANCELLED', 'STARTUP_FAILURE', 'ACTION_REQUIRED'].includes(
        check.conclusion ?? '',
      ),
    )
      ? 'fail'
      : 'pass';
  });
  const measuredRobotStates = robotStates ?? [];
  const ciState: State =
    robotCount === undefined
      ? 'unknown'
      : [main, ...measuredRobotStates].includes('fail')
        ? 'fail'
        : [main, ...measuredRobotStates].includes('pending')
          ? 'pending'
          : main === 'pass'
            ? 'pass'
            : 'unknown';
  const mainClause =
    main === 'pass'
      ? 'main is green'
      : main === 'fail'
        ? 'main is red'
        : main === 'pending'
          ? 'main is still running'
          : 'main was not measured';
  let robotClause = 'robot jobs not measured';
  if (!robotChecksMeasured && robotCount !== undefined) {
    robotClause =
      robotCount === 0
        ? 'nothing in flight'
        : `${robotCount} robot job${robotCount === 1 ? '' : 's'}, checks not measured`;
  } else if (robotStates) {
    if (robotStates.length === 0) robotClause = 'nothing in flight';
    else {
      const failed = robotStates.filter((state) => state === 'fail').length;
      const pending = robotStates.filter((state) => state === 'pending').length;
      const count = failed || pending || robotStates.length;
      const adjective = failed ? 'red' : pending ? 'still running' : 'green';
      robotClause = `${count} robot job${count === 1 ? '' : 's'} ${adjective}`;
    }
  }
  return {
    ciState,
    ciDetail: `${mainClause}, ${robotClause}`,
    ...(robotCount !== undefined ? { codexPrsOpen: robotCount } : {}),
    ...(rate
      ? { ghRateRemaining: rate.resources.core.remaining, ghRateLimit: rate.resources.core.limit }
      : {}),
  };
}
