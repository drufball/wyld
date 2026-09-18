import { z } from 'zod';
import {
  BODY_PLANS,
  DELIVERIES,
  FORCES,
  HIDES,
  INNATE,
  PHASES,
  RARITIES,
  TEMPERAMENTS,
  TRACK_KINDS,
  WAVEFORMS,
} from './species.js';

const Range = z.tuple([z.number(), z.number()]);
// This schema supplies the shared data shape; validateSpecies applies the game's cross-field rules.
export const Species = z.object({
  id: z.string(),
  name: z.string(),
  rarity: z.enum(RARITIES),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  bodyPlan: z.enum(BODY_PLANS),
  hide: z.enum(HIDES),
  innate: z.array(z.enum(INNATE)),
  forces: z.array(z.enum(FORCES)),
  stats: z.object({ vigor: Range, power: Range, speed: Range, focus: Range }),
  temperament: z.partialRecord(z.enum(TEMPERAMENTS), z.number()),
  habitat: z.array(z.object({ region: z.string(), phases: z.array(z.enum(PHASES)) })),
  signatureMoves: z.array(
    z.object({
      name: z.string(),
      delivery: z.enum(DELIVERIES),
      force: z.enum(FORCES),
      power: z.number(),
      speed: z.number(),
    }),
  ),
  tracks: z.object({
    kind: z.enum(TRACK_KINDS),
    toes: z.number().optional(),
    drag: z.boolean().optional(),
    stride: z.number().optional(),
  }),
  hints: z.object({ tracks: z.string(), call: z.string(), identified: z.string() }),
  call: z.object({
    waveform: z.enum(WAVEFORMS),
    notes: z.array(z.object({ freq: z.number(), dur: z.number() })),
    noise: z.number().optional(),
  }),
  palette: z.object({ primary: z.string(), secondary: z.string(), accent: z.string().optional() }),
  visual: z.record(z.string(), z.number()),
});
export type SpeciesData = z.infer<typeof Species>;
export const SpeciesDraft = z.object({
  speciesId: z.string(),
  state: z.enum(['edited', 'new', 'deleted']),
  data: Species.nullable(),
  updatedAt: z.string(),
});
export type SpeciesDraft = z.infer<typeof SpeciesDraft>;
export const Region = z.object({ id: z.string(), name: z.string(), biome: z.string() });
export type Region = z.infer<typeof Region>;
export const SpeciesLibrary = z.object({
  species: Species.array(),
  regions: Region.array(),
  drafts: SpeciesDraft.array(),
  references: z.record(z.string(), z.array(z.string())),
});
export type SpeciesLibrary = z.infer<typeof SpeciesLibrary>;
export const ShipSummarySchema = z.object({
  added: z.array(z.string()),
  removed: z.array(z.string()),
  changed: z.array(z.object({ id: z.string(), fields: z.array(z.string()) })),
});
export const ShipResult = z.discriminatedUnion('shipped', [
  z.object({ shipped: z.literal(true), summary: ShipSummarySchema, prUrl: z.string() }),
  z.object({ shipped: z.literal(false), problems: z.array(z.string()) }),
]);
export type ShipResult = z.infer<typeof ShipResult>;
