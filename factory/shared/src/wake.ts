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

// Queue entries passed ingress validation; older consumers must still deliver new source/kind strings.
export const WakeMessageWire = z.object({
  source: z.string().min(1),
  kind: z.string().min(1),
  quest: Id.optional(),
  chain: z.number().int().positive().optional(),
  issue: z.number().int().positive().optional(),
  pr: z.number().int().positive().optional(),
  url: z.url().optional(),
  summary: z.string().min(1),
  ts: Timestamp,
});
export type WakeMessageWire = z.infer<typeof WakeMessageWire>;
