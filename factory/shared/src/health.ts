import { z } from 'zod';

export const PlannerState = z.enum(['online', 'idle', 'working', 'paused', 'down']);
export type PlannerState = z.infer<typeof PlannerState>;

export const CiState = z.enum(['pass', 'fail', 'pending', 'unknown']);
export type CiState = z.infer<typeof CiState>;

export const HealthReport = z
  .object({
    plannerState: PlannerState,
    currentTask: z.string().max(200).optional(),
    wakeQueueDepth: z.number().int().min(0).optional(),
    ghRateRemaining: z.number().int().min(0).optional(),
    ciState: CiState.optional(),
    costToday: z.number().min(0).optional(),
    codexPrsOpen: z.number().int().min(0).optional(),
    pausedReason: z.string().max(280).optional(),
  })
  .strict();
export type HealthReport = z.infer<typeof HealthReport>;

export const OpsReport = z
  .object({
    ciState: CiState,
    ciDetail: z.string().max(200).optional(),
    codexPrsOpen: z.number().int().min(0),
    ghRateRemaining: z.number().int().min(0).optional(),
    ghRateLimit: z.number().int().min(0).optional(),
    tokensToday: z.number().int().min(0).optional(),
  })
  .strict();
export type OpsReport = z.infer<typeof OpsReport>;

export const HealthSnapshot = z
  .object({
    ts: z.iso.datetime(),
    planner: z.object({
      state: PlannerState,
      currentTask: z.string().optional(),
      lastReportAt: z.iso.datetime().optional(),
    }),
    server: z.object({
      ok: z.boolean(),
      db: z.enum(['ok', 'error']),
      uptimeSeconds: z.number(),
      version: z.string(),
      eventsToday: z.number().int().min(0),
    }),
    wake: z.object({
      reachable: z.boolean(),
      queueDepth: z.number().int().min(0).optional(),
      oldestPendingTs: z.string().optional(),
      lastDeliveryAt: z.string().optional(),
      lastGithubEventAt: z.string().optional(),
    }),
    github: z.object({
      ciState: CiState,
      ciDetail: z.string().optional(),
      rateRemaining: z.number().int().min(0).optional(),
      rateLimit: z.number().int().min(0).optional(),
      codexPrsOpen: z.number().int().min(0).optional(),
      reportedAt: z.iso.datetime().optional(),
      source: z.enum(['ops', 'planner', 'none']),
    }),
    tokensToday: z.number().int().min(0).optional(),
    costToday: z.number().min(0).optional(),
    pausedReason: z.string().optional(),
  })
  .strict();
export type HealthSnapshot = z.infer<typeof HealthSnapshot>;
