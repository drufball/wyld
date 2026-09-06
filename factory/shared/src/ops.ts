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

export const SleepPhase = z.enum(['drain', 'sweep', 'qa', 'retro', 'reset', 'ended']);
export type SleepPhase = z.infer<typeof SleepPhase>;
export const SleepTrigger = z.enum(['human', 'schedule']);
export type SleepTrigger = z.infer<typeof SleepTrigger>;
export const SleepOutcome = z.enum(['clean', 'timed_out', 'paused']);
export type SleepOutcome = z.infer<typeof SleepOutcome>;
export const SleepAlarm = z.enum(['goodnight', 'last_call', 'lights_on']);
export type SleepAlarm = z.infer<typeof SleepAlarm>;
export const SleepPhaseEntry = z.object({
  phase: SleepPhase,
  at: Timestamp,
  note: z.string().min(1).optional(),
});
export type SleepPhaseEntry = z.infer<typeof SleepPhaseEntry>;
export const SleepRun = z.object({
  id: z.number().int().positive(),
  started: Timestamp,
  ended: Timestamp.nullable(),
  trigger: SleepTrigger,
  phases: z.array(SleepPhaseEntry),
  alarmsFired: z.array(SleepAlarm),
  outcome: SleepOutcome.nullable(),
  leftoversParked: z.array(Id),
});
export type SleepRun = z.infer<typeof SleepRun>;

export const SleepSchedule = z.object({
  goodnightAt: Timestamp,
  lastCallAt: Timestamp,
  lightsOnAt: Timestamp,
});
export type SleepSchedule = z.infer<typeof SleepSchedule>;
export const SleepCurrent = z.object({ run: SleepRun.nullable(), schedule: SleepSchedule });
export type SleepCurrent = z.infer<typeof SleepCurrent>;

export const Retro = z.object({
  id: z.number().int().positive(),
  date: z.iso.date(),
  summary: z.string(),
  wins: z.array(z.string()),
  misses: z.array(z.string()),
  factoryImprovements: z.array(Id),
  stats: z.record(z.string(), z.number()),
  generatedBy: z.enum(['planner', 'mechanical']),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Retro = z.infer<typeof Retro>;

export const NewRetro = z.object({
  summary: z.string(),
  wins: z.array(z.string()).default([]),
  misses: z.array(z.string()).default([]),
  factoryImprovements: z.array(Id).default([]),
  stats: z.record(z.string(), z.number()).default({}),
});
export type NewRetro = z.infer<typeof NewRetro>;

export const Achievement = z.object({
  id: Id,
  name: z.string().min(1),
  unlockedAt: Timestamp,
  badge: z.string().min(1),
});
export type Achievement = z.infer<typeof Achievement>;
