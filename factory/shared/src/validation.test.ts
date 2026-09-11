import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { formatIssues } from './validation.js';

describe('formatIssues', () => {
  it('returns the invalid request error and Zod issues', () => {
    const result = z.string().safeParse(1);
    if (result.success) throw new Error('Expected validation to fail');

    expect(formatIssues(result.error)).toEqual({
      error: 'Invalid request',
      issues: result.error.issues,
    });
  });
});
