import { z } from 'zod';

import { Id, Timestamp } from './ids.js';

export const Demo = z.object({
  id: Id,
  questId: Id,
  ref: z.string().min(1),
  url: z.url(),
  builtAt: Timestamp,
  status: z.string().min(1),
  screenshot: z.string().min(1).optional(),
});
export type Demo = z.infer<typeof Demo>;

export const Feedback = z.object({
  id: Id,
  demoId: Id,
  text: z.string().min(1),
  screenshot: z.string().min(1).optional(),
  created: Timestamp,
});
export type Feedback = z.infer<typeof Feedback>;
