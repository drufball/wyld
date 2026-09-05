import { z } from 'zod';

import { EventKind, EventSource } from './event.js';
import { Id, Timestamp } from './ids.js';

export const WakeMessage = z.object({
  source: EventSource,
  kind: EventKind,
  quest: Id.optional(),
  chain: z.number().int().positive().optional(),
  issue: z.number().int().positive().optional(),
  pr: z.number().int().positive().optional(),
  url: z.url().optional(),
  summary: z.string().min(1),
  ts: Timestamp,
});
export type WakeMessage = z.infer<typeof WakeMessage>;
