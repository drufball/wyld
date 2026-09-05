import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { z } from 'zod';

const execFileAsync = promisify(execFile);

export type CommandRunner = (command: string, args: string[]) => Promise<string>;

export const runCommand: CommandRunner = async (command, args) => {
  const { stdout } = await execFileAsync(command, args, { timeout: 20_000 });
  return stdout;
};

const Runs = z.array(
  z.object({ status: z.string(), conclusion: z.string().nullable(), workflowName: z.string() }),
);
const PullRequests = z.array(
  z.object({
    number: z.number(),
    headRefName: z.string(),
    isDraft: z.boolean(),
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
const RateLimit = z.object({ resources: z.object({ core: z.object({ remaining: z.number(), limit: z.number() }) }) });

type State = 'pass' | 'fail' | 'pending' | 'unknown';
export type GithubStatus = {
  ciState: State;
  ciDetail: string;
  codexPrsOpen?: number;
  ghRateRemaining?: number;
  ghRateLimit?: number;
};

function reportReadError(source: string, error: unknown): void {
  process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'github measurement failed', source, error: error instanceof Error ? error.message : String(error) })}\n`);
}

export async function readGithubStatus(repo: string, run: CommandRunner = runCommand): Promise<GithubStatus> {
  const calls = await Promise.allSettled([
    run('gh', ['run', 'list', '--repo', repo, '--branch', 'main', '--limit', '1', '--json', 'status,conclusion,workflowName']),
    run('gh', ['pr', 'list', '--repo', repo, '--state', 'open', '--limit', '50', '--json', 'number,headRefName,isDraft,statusCheckRollup']),
    run('gh', ['api', 'rate_limit']),
  ]);

  let main: State = 'unknown';
  let robots: z.infer<typeof PullRequests> | undefined;
  let rate: z.infer<typeof RateLimit> | undefined;
  try {
    if (calls[0].status === 'rejected') throw calls[0].reason;
    const latest = Runs.parse(JSON.parse(calls[0].value))[0];
    if (latest) main = latest.status !== 'completed' ? 'pending' : latest.conclusion === 'success' ? 'pass' : 'fail';
  } catch (error) { reportReadError('runs', error); }
  try {
    if (calls[1].status === 'rejected') throw calls[1].reason;
    robots = PullRequests.parse(JSON.parse(calls[1].value)).filter((pr) => pr.headRefName.startsWith('codex/'));
  } catch (error) { reportReadError('pull requests', error); }
  try {
    if (calls[2].status === 'rejected') throw calls[2].reason;
    rate = RateLimit.parse(JSON.parse(calls[2].value));
  } catch (error) { reportReadError('rate limit', error); }

  const robotStates = robots?.map<State>((pr) => {
    if (pr.statusCheckRollup.length === 0) return 'fail';
    if (pr.statusCheckRollup.some((check) => check.status !== 'COMPLETED')) return 'pending';
    return pr.statusCheckRollup.some((check) => ['FAILURE', 'TIMED_OUT', 'CANCELLED', 'STARTUP_FAILURE', 'ACTION_REQUIRED'].includes(check.conclusion ?? '')) ? 'fail' : 'pass';
  });
  const measuredRobotStates = robotStates ?? [];
  const ciState: State = robots === undefined ? 'unknown' : [main, ...measuredRobotStates].includes('fail') ? 'fail' : [main, ...measuredRobotStates].includes('pending') ? 'pending' : main === 'pass' ? 'pass' : 'unknown';
  const mainClause = main === 'pass' ? 'main is green' : main === 'fail' ? 'main is red' : main === 'pending' ? 'main is still running' : 'main was not measured';
  let robotClause = 'robot jobs not measured';
  if (robotStates) {
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
    ...(robots ? { codexPrsOpen: robots.length } : {}),
    ...(rate ? { ghRateRemaining: rate.resources.core.remaining, ghRateLimit: rate.resources.core.limit } : {}),
  };
}
