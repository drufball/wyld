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

export const Catchup = z.object({
  id: z.number().int().positive(),
  fromEventId: z.number().int().min(0),
  toEventId: z.number().int().min(0),
  digest: CatchupDigest,
  generatedBy: z.enum(['planner', 'mechanical']),
  createdAt: Timestamp,
});
export type Catchup = z.infer<typeof Catchup>;

export const CatchupView = z.object({
  show: z.boolean(),
  awaySeconds: z.number().int().min(0),
  unseenCount: z.number().int().min(0),
  catchup: Catchup,
  nextAction: NextAction.nullable(),
});
export type CatchupView = z.infer<typeof CatchupView>;
