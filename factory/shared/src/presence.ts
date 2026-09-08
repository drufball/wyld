import { z } from 'zod';

import { EventId, Timestamp } from './ids.js';

export const NextAction = z.object({
  text: z.string().min(1),
  deepLink: z
    .string()
    .regex(/^\/(?!\/)/)
    .optional(),
  backAt: Timestamp.optional(),
});
export type NextAction = z.infer<typeof NextAction>;

export const Presence = z.object({
  lastSeenAt: Timestamp,
  lastCatchupEventId: EventId.nullable(),
  nextAction: NextAction.nullable(),
  needsYou: z.number().int().min(0).default(0),
});
export type Presence = z.infer<typeof Presence>;

export const CatchupLine = z.object({
  text: z.string().min(1),
  deepLink: z
    .string()
    .regex(/^\/(?!\/)/)
    .optional(),
});
export type CatchupLine = z.infer<typeof CatchupLine>;

export const CatchupDigest = z.object({
  rumbles: z.array(CatchupLine),
  demos: z.array(CatchupLine),
  shipped: z.array(CatchupLine),
  fyi: z.array(z.string().min(1)),
});
export type CatchupDigest = z.infer<typeof CatchupDigest>;
