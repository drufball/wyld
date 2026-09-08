import { z } from 'zod';

import { Id, Timestamp } from './ids.js';
import { ArtifactSlug } from './artifact.js';
import { Rumble } from './rumble.js';

export const ChainStatus = z.enum(['open', 'settled', 'converted']);
export const ChainKind = z.enum([
  'question',
  'message',
  'rumble',
  'demo',
  'action',
  'unlock',
  'briefing',
]);
export type ChainStatus = z.infer<typeof ChainStatus>;
export type ChainKind = z.infer<typeof ChainKind>;

export const ChainAnchor = z
  .object({
    artifact: ArtifactSlug,
    element: z.string().min(1).max(120),
    label: z.string().min(1).max(80),
  })
  .strict();
export type ChainAnchor = z.infer<typeof ChainAnchor>;

export const ChainCapture = z
  .object({
    screenshot: z.string().nullable().default(null),
    state: z.unknown().nullable().default(null),
  })
  .strict();

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
    tags: z.array(z.string()).default([]),
    demoId: Id.nullable().default(null),
    payload: z.record(z.string(), z.unknown()).nullable().default(null),
    rumble: Rumble.nullable().default(null),
    anchor: ChainAnchor.nullable().default(null),
    messages: ChainMessage.array(),
  })
  .superRefine((chain, context) => {
    if ((chain.kind === 'rumble') !== (chain.rumble !== null))
      context.addIssue({
        code: 'custom',
        path: ['rumble'],
        message: 'rumble must be non-null exactly when kind is rumble',
      });
    if ((chain.kind === 'demo') !== (chain.demoId !== null))
      context.addIssue({
        code: 'custom',
        path: ['demoId'],
        message: 'demoId must be non-null exactly when kind is demo',
      });
  });
export type Chain = z.infer<typeof Chain>;
