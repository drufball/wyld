import { z } from 'zod';

import { Id, Timestamp } from './ids.js';

export const Rumble = z.object({
  id: Id,
  title: z.string().min(1),
  context: z.string().min(1),
  options: z.array(z.string().min(1)),
  chosen: z.string().min(1),
  chosenAt: Timestamp,
  blockingQuestIds: z.array(Id),
  kind: z.enum(['account', 'money', 'model', 'taste', 'scope', 'outage']),
});
export type Rumble = z.infer<typeof Rumble>;
