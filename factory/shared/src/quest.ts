import { z } from 'zod';

import { Id, Timestamp } from './ids.js';

export const QuestStatus = z.enum(['idea', 'planning', 'building', 'demo', 'done', 'parked']);
export type QuestStatus = z.infer<typeof QuestStatus>;

export const World = z.object({
  id: Id,
  name: z.string().min(1),
  kind: z.enum(['game', 'factory']),
  order: z.number().int().nonnegative(),
  icon: z.string().min(1),
});
export type World = z.infer<typeof World>;

export const QuestCounts = z.record(QuestStatus, z.number().int().nonnegative());
export const WorldWithQuestCounts = World.extend({ questCounts: QuestCounts });
export type WorldWithQuestCounts = z.infer<typeof WorldWithQuestCounts>;

export const Quest = z.object({
  id: Id,
  worldId: Id,
  title: z.string().min(1),
  pitch: z.string().min(1),
  status: QuestStatus,
  progress: z.number().min(0).max(1),
  sinceYouLooked: z.string(),
  lastNote: z.string(),
});
export type Quest = z.infer<typeof Quest>;

export const QuestNote = z.object({
  id: z.number().int().positive(),
  questId: Id,
  author: z.enum(['planner', 'human']),
  text: z.string().min(1),
  ts: Timestamp,
});
export type QuestNote = z.infer<typeof QuestNote>;

export const QuestLink = z.object({
  questId: Id,
  ghKind: z.enum(['issue', 'pr', 'branch']),
  ghRef: z.string().min(1),
  state: z.string().min(1),
});
export type QuestLink = z.infer<typeof QuestLink>;
