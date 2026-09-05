import { describe, expect, it } from 'vitest';
import { readGithubStatus, type CommandRunner } from './github.js';

const check = (conclusion: string, status = 'COMPLETED') => ({ __typename: 'CheckRun', name: 'ci', status, conclusion });
function runner(main: object, prs: object[], fail = false): CommandRunner {
  return async (_command, args) => {
    if (fail) throw new Error('gh unavailable');
    if (args[0] === 'run') return JSON.stringify([main]);
    if (args[0] === 'pr') return JSON.stringify(prs);
    return JSON.stringify({ resources: { core: { remaining: 123, limit: 5000 } } });
  };
}
const greenMain = { status: 'completed', conclusion: 'success', workflowName: 'CI' };
const pr = (headRefName: string, statusCheckRollup: object[]) => ({ number: 64, headRefName, isDraft: false, statusCheckRollup });

describe('readGithubStatus', () => {
  it('reports all green and makes exactly three calls', async () => {
    let calls = 0;
    const base = runner(greenMain, [pr('codex/one', [check('SUCCESS')]), pr('feature/human', [check('FAILURE')])]);
    const result = await readGithubStatus('owner/repo', async (...args) => { calls += 1; return base(...args); });
    expect(calls).toBe(3);
    expect(result).toEqual({ ciState: 'pass', ciDetail: 'main is green, 1 robot job green', codexPrsOpen: 1, ghRateRemaining: 123, ghRateLimit: 5000 });
    expect(result.ciDetail).not.toMatch(/64|codex\/|https?:/);
  });
  it('reports red main with nothing in flight', async () => {
    expect(await readGithubStatus('r', runner({ ...greenMain, conclusion: 'failure' }, []))).toMatchObject({ ciState: 'fail', ciDetail: 'main is red, nothing in flight' });
  });
  it.each([[ [check('FAILURE')], 'fail' ], [ [], 'fail' ], [ [check('SUCCESS', 'IN_PROGRESS')], 'pending' ]] as const)('classifies robot checks', async (rollup, state) => {
    expect((await readGithubStatus('r', runner(greenMain, [pr('codex/work', [...rollup])]))).ciState).toBe(state);
  });
  it('survives gh errors without inventing rate values', async () => {
    const result = await readGithubStatus('r', runner(greenMain, [], true));
    expect(result).toMatchObject({ ciState: 'unknown' });
    expect(result).not.toHaveProperty('ghRateRemaining');
    expect(result).not.toHaveProperty('codexPrsOpen');
  });
});
