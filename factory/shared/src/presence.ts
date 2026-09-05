import { z } from 'zod';

import { EventId, Id, Timestamp } from './ids.js';

export const NextAction = z.object({
  text: z.string().min(1),
  deepLink: z.string().startsWith('/').optional(),
});
export type NextAction = z.infer<typeof NextAction>;

export const Presence = z.object({
  lastSeenAt: Timestamp,
  lastCatchupEventId: EventId.nullable(),
  nextAction: NextAction.nullable(),
});
export type Presence = z.infer<typeof Presence>;

export const CatchupDigest = z.object({
  rumbles: z.array(Id),
  demos: z.array(Id),
  shipped: z.array(Id),
  fyi: z.array(z.string()),
});
export type CatchupDigest = z.infer<typeof CatchupDigest>;

export const Catchup = z.object({
  id: Id,
  fromEventId: EventId,
  toEventId: EventId,
  digest: CatchupDigest,
  generatedBy: z.enum(['planner', 'mechanical']),
});
export type Catchup = z.infer<typeof Catchup>;
