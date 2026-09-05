import { describe, expect, it } from 'vitest';

import { deriveProgress } from './progress.js';

const link = (ghKind: 'issue' | 'pr' | 'branch', state: string) => ({
  questId: 'quest',
  ghKind,
  ghRef: 'reference',
  state,
});

describe('deriveProgress', () => {
  it('returns zero with no links', () => expect(deriveProgress('building', [])).toBe(0));
  it('returns zero when all links are open', () =>
    expect(deriveProgress('building', [link('issue', 'open')])).toBe(0));
  it('rounds mixed completion to two places', () =>
    expect(
      deriveProgress('building', [link('issue', 'closed'), link('pr', 'open'), link('pr', 'open')]),
    ).toBe(0.33));
  it('ignores branch links', () =>
    expect(deriveProgress('building', [link('branch', 'closed')])).toBe(0));
  it('always completes done quests', () => expect(deriveProgress('done', [])).toBe(1));
});
