import { z } from 'zod';

import { Id, Timestamp } from './ids.js';
import { Rumble } from './rumble.js';

export const ChainStatus = z.enum(['open', 'settled', 'converted']);
export const ChainKind = z.enum(['question', 'message', 'rumble']);
export type ChainStatus = z.infer<typeof ChainStatus>;

export const ChainMessage = z.object({
  id: z.number().int().positive(),
  chainId: z.number().int().positive(),
  author: z.enum(['human', 'planner']),
  text: z.string().min(1),
  ts: Timestamp,
});
export type ChainMessage = z.infer<typeof ChainMessage>;

export const Chain = z
  .object({
    id: z.number().int().positive(),
    kind: ChainKind.default('question'),
    status: ChainStatus,
    createdAt: Timestamp,
    lastActivityAt: Timestamp,
    questId: Id.nullable(),
    snoozedUntil: Timestamp.nullable().default(null),
    rumble: Rumble.nullable().default(null),
    messages: ChainMessage.array(),
  })
  .superRefine((chain, context) => {
    if ((chain.kind === 'rumble') !== (chain.rumble !== null))
      context.addIssue({
        code: 'custom',
        path: ['rumble'],
        message: 'rumble must be non-null exactly when kind is rumble',
      });
  });
export type Chain = z.input<typeof Chain>;
