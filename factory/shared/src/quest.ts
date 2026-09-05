import { z } from 'zod';

import { Id } from './ids.js';

export const World = z.object({
  id: Id,
  name: z.string().min(1),
  kind: z.enum(['game', 'factory']),
  order: z.number().int().nonnegative(),
  icon: z.string().min(1),
});
export type World = z.infer<typeof World>;

export const Quest = z.object({
  id: Id,
  worldId: Id,
  title: z.string().min(1),
  pitch: z.string().min(1),
  status: z.enum(['idea', 'planning', 'building', 'demo', 'done', 'parked']),
  progress: z.number().min(0).max(1),
  sinceYouLooked: z.string(),
  lastNote: z.string(),
});
export type Quest = z.infer<typeof Quest>;

export const QuestLink = z.object({
  questId: Id,
  ghKind: z.enum(['issue', 'pr', 'branch']),
  ghRef: z.string().min(1),
  state: z.string().min(1),
});
export type QuestLink = z.infer<typeof QuestLink>;
