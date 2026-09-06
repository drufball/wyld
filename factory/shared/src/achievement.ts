import { z } from 'zod';

import { Id, Timestamp } from './ids.js';

export const Achievement = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string().min(1),
  badge: z.string().min(1),
  unlockedAt: Timestamp.nullable(),
});
export type Achievement = z.infer<typeof Achievement>;
