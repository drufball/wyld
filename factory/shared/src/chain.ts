import { z } from 'zod';

import { Id, Timestamp } from './ids.js';

export const ChainStatus = z.enum(['open', 'settled', 'converted']);
export type ChainStatus = z.infer<typeof ChainStatus>;

export const ChainMessage = z.object({
  id: z.number().int().positive(),
  chainId: z.number().int().positive(),
  author: z.enum(['human', 'planner']),
  text: z.string().min(1),
  ts: Timestamp,
});
export type ChainMessage = z.infer<typeof ChainMessage>;

export const Chain = z.object({
  id: z.number().int().positive(),
  status: ChainStatus,
  createdAt: Timestamp,
  lastActivityAt: Timestamp,
  questId: Id.nullable(),
  messages: ChainMessage.array(),
});
export type Chain = z.infer<typeof Chain>;
