import { z } from 'zod';

import { Id, Timestamp } from './ids.js';

export const RumbleKind = z.enum(['account', 'money', 'model', 'taste', 'scope', 'outage']);

export const Rumble = z.object({
  id: Id,
  title: z.string().min(1),
  context: z.string().min(1),
  options: z.array(z.string().min(1)).min(1).max(4),
  chosen: z.string().min(1).nullable(),
  chosenAt: Timestamp.nullable(),
  blockingQuestIds: z.array(Id),
  kind: RumbleKind,
});
export type Rumble = z.infer<typeof Rumble>;

export const NewRumble = Rumble.omit({ id: true, chosen: true, chosenAt: true })
  .extend({ id: Id.optional(), blockingQuestIds: z.array(Id).default([]) })
  .strict();
export type NewRumble = z.infer<typeof NewRumble>;

export const RumbleDecision = z.object({ chosen: z.string().min(1) }).strict();
export type RumbleDecision = z.infer<typeof RumbleDecision>;
