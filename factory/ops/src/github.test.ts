import { describe, expect, it } from 'vitest';
import { readGithubStatus, type CommandRunner } from './github.js';

const check = (conclusion: string, status = 'COMPLETED') => ({
  __typename: 'CheckRun',
  name: 'ci',
  status,
  conclusion,
});
function runner(main: object, prs: object[], fail = false): CommandRunner {
  return async (_command, args) => {
    if (fail) throw new Error('gh unavailable');
    if (args[0] === 'run') return JSON.stringify([main]);
    if (args[0] === 'pr') return JSON.stringify(prs);
    return JSON.stringify({ resources: { core: { remaining: 123, limit: 5000 } } });
  };
}
const greenMain = { status: 'completed', conclusion: 'success', workflowName: 'CI' };
const pr = (headRefName: string, statusCheckRollup: object[]) => ({
  number: 64,
  headRefName,
  isDraft: false,
  statusCheckRollup,
});

describe('readGithubStatus', () => {
  it('reports all green and makes exactly three calls', async () => {
    let calls = 0;
    const base = runner(greenMain, [
      pr('codex/one', [check('SUCCESS')]),
      pr('feature/human', [check('FAILURE')]),
    ]);
    const result = await readGithubStatus('owner/repo', async (...args) => {
      calls += 1;
      return base(...args);
    });
    expect(calls).toBe(3);
    expect(result).toEqual({
      ciState: 'pass',
      ciDetail: 'main is green, 1 robot job green',
      codexPrsOpen: 1,
      ghRateRemaining: 123,
      ghRateLimit: 5000,
    });
    expect(result.ciDetail).not.toMatch(/64|codex\/|https?:/);
  });
  it('reports red main with nothing in flight', async () => {
    expect(
      await readGithubStatus('r', runner({ ...greenMain, conclusion: 'failure' }, [])),
    ).toMatchObject({ ciState: 'fail', ciDetail: 'main is red, nothing in flight' });
  });
  it.each([
    [[check('FAILURE')], 'fail'],
    [[], 'fail'],
    [[check('SUCCESS', 'IN_PROGRESS')], 'pending'],
  ] as const)('classifies robot checks', async (rollup, state) => {
    expect(
      (await readGithubStatus('r', runner(greenMain, [pr('codex/work', [...rollup])]))).ciState,
    ).toBe(state);
  });
  it('survives gh errors without inventing rate values', async () => {
    const result = await readGithubStatus('r', runner(greenMain, [], true));
    expect(result).toMatchObject({ ciState: 'unknown' });
    expect(result).not.toHaveProperty('ghRateRemaining');
    expect(result).not.toHaveProperty('codexPrsOpen');
  });
  it('falls back to counting robot PRs when check rollups cannot be read', async () => {
    const calls: string[][] = [];
    const result = await readGithubStatus('owner/repo', async (_command, args) => {
      calls.push(args);
      if (args[0] === 'run') return JSON.stringify([greenMain]);
      if (args[0] === 'api') {
        return JSON.stringify({ resources: { core: { remaining: 123, limit: 5000 } } });
      }
      if (args.at(-1)?.includes('statusCheckRollup')) throw new Error('field unavailable');
      return JSON.stringify([
        { number: 67, headRefName: 'codex/reporter', isDraft: false },
        { number: 68, headRefName: 'feature/human', isDraft: false },
      ]);
    });

    expect(calls).toHaveLength(4);
    expect(calls[3]).toEqual([
      'pr',
      'list',
      '--repo',
      'owner/repo',
      '--state',
      'open',
      '--limit',
      '50',
      '--json',
      'number,headRefName,isDraft',
    ]);
    expect(result).toEqual({
      ciState: 'pass',
      ciDetail: 'main is green, 1 robot job, checks not measured',
      codexPrsOpen: 1,
      ghRateRemaining: 123,
      ghRateLimit: 5000,
    });
  });
  it('leaves the robot count unmeasured when both PR-list attempts fail', async () => {
    let prCalls = 0;
    const result = await readGithubStatus('r', async (_command, args) => {
      if (args[0] === 'run') return JSON.stringify([greenMain]);
      if (args[0] === 'api') {
        return JSON.stringify({ resources: { core: { remaining: 123, limit: 5000 } } });
      }
      prCalls += 1;
      throw new Error('PR list unavailable');
    });

    expect(prCalls).toBe(2);
    expect(result).toMatchObject({
      ciState: 'unknown',
      ciDetail: 'main is green, robot jobs not measured',
      ghRateRemaining: 123,
      ghRateLimit: 5000,
    });
    expect(result).not.toHaveProperty('codexPrsOpen');
  });
});
