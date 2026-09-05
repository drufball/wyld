import { z } from 'zod';

export const Id = z.string().min(1);
export type Id = z.infer<typeof Id>;

export const Timestamp = z.iso.datetime();
export type Timestamp = z.infer<typeof Timestamp>;
