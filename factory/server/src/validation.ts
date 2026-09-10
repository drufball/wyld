import { z } from 'zod';

export function formatIssues(error: z.ZodError) {
  return { error: 'Invalid request', issues: error.issues };
}
