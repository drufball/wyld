import { z } from 'zod';

import { Id, Timestamp } from './ids.js';

export const Health = z.object({
  ts: Timestamp,
  plannerState: z.string().min(1),
  wakeQueueDepth: z.number().int().nonnegative(),
  ghRateRemaining: z.number().int().nonnegative(),
  ciState: z.string().min(1),
  costToday: z.number().nonnegative(),
  codexPrsOpen: z.number().int().nonnegative(),
  pausedReason: z.string().min(1).optional(),
});
export type Health = z.infer<typeof Health>;

export const SleepRun = z.object({
  id: Id,
  started: Timestamp,
  ended: Timestamp,
  phases: z.array(z.string().min(1)),
  outcome: z.string().min(1),
  leftoversParked: z.array(Id),
});
export type SleepRun = z.infer<typeof SleepRun>;

export const Retro = z.object({
  id: Id,
  date: z.iso.date(),
  wins: z.array(z.string()),
  misses: z.array(z.string()),
  factoryImprovements: z.array(Id),
  stats: z.record(z.string(), z.number()),
});
export type Retro = z.infer<typeof Retro>;

export const Achievement = z.object({
  id: Id,
  name: z.string().min(1),
  unlockedAt: Timestamp,
  badge: z.string().min(1),
});
export type Achievement = z.infer<typeof Achievement>;
