import { z } from 'zod';

import { Id, Timestamp } from './ids.js';

export const DemoStatus = z.enum(['building', 'ready', 'failed']);
export type DemoStatus = z.infer<typeof DemoStatus>;

export const DemoKind = z.enum(['disc', 'live']);
export type DemoKind = z.infer<typeof DemoKind>;

export const Demo = z.object({
  id: Id,
  questId: Id.nullable(),
  title: z.string().min(1),
  ref: z.string().min(1),
  url: z.string().min(1),
  kind: DemoKind.default('disc'),
  summary: z.string().nullable().default(null),
  steps: z.array(z.string()).default([]),
  seeded: z.array(z.string()).default([]),
  deepLink: z.string().nullable().default(null),
  status: DemoStatus,
  builtAt: Timestamp.nullable(),
  error: z.string().nullable(),
});
export type Demo = z.infer<typeof Demo>;

export const NewDemo = z.object({
  id: Id,
  ref: z
    .string()
    .min(1)
    .refine((ref) => !ref.startsWith('-'), {
      message: 'ref must not start with -',
    }),
  questId: Id.optional(),
  title: z.string().min(1).optional(),
  kind: DemoKind.optional(),
  summary: z.string().optional(),
  steps: z.array(z.string()).optional(),
  seeded: z.array(z.string()).optional(),
  deepLink: z.string().optional(),
});
export type NewDemo = z.infer<typeof NewDemo>;

export const Feedback = z.object({
  id: z.number().int().positive(),
  demoId: Id,
  questId: Id.nullable(),
  text: z.string().min(1),
  state: z.record(z.string(), z.unknown()).nullable(),
  hasScreenshot: z.boolean(),
  created: Timestamp,
});
export type Feedback = z.infer<typeof Feedback>;

export const NewFeedback = z.object({
  demoId: Id,
  text: z.string().min(1),
  screenshot: z.string().optional(),
  state: z.record(z.string(), z.unknown()).optional(),
});
export type NewFeedback = z.infer<typeof NewFeedback>;
