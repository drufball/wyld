import { z } from 'zod';

import { EventId, Id, Timestamp } from './ids.js';

export const EventSource = z.enum(['human', 'github', 'planner', 'sleep', 'system']);
export type EventSource = z.infer<typeof EventSource>;

// Event kinds follow <source>.<verb>: the prefix is an EventSource and the verb is snake_case.
// Add new kinds here first so every factory consumer shares the same vocabulary.
export const EVENT_KINDS = [
  'human.intent',
  'human.feedback',
  'human.decision',
  'human.seen',
  'github.pr_opened',
  'github.pr_synced',
  'github.ci_completed',
  'github.issue_comment',
  'planner.note',
  'planner.quest_updated',
  'planner.next_action',
  'system.paused',
  'system.resumed',
  'sleep.phase',
] as const;

export const EventKind = z.enum(EVENT_KINDS);
export type EventKind = z.infer<typeof EventKind>;

export const Event = z
  .object({
    id: EventId,
    ts: Timestamp,
    source: EventSource,
    kind: EventKind,
    payload: z.record(z.string(), z.unknown()),
    questId: Id.optional(),
  })
  .strict();
export type Event = z.infer<typeof Event>;

export const NewEvent = Event.omit({ id: true, ts: true });
export type NewEvent = z.infer<typeof NewEvent>;
