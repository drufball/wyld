import { z } from 'zod';

export const Id = z.string().min(1);
export type Id = z.infer<typeof Id>;

export const EventId = z.number().int().positive();
export type EventId = z.infer<typeof EventId>;

export const Timestamp = z.iso.datetime();
export type Timestamp = z.infer<typeof Timestamp>;
