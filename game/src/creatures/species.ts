import type { BodyPlanId } from '@wyld/sprites';
import type { Delivery, Force } from '../combat/moves.js';
import speciesJson from '../data/species.json';
import type { Phase } from '../world/time.js';
import { regions } from '../world/regions.js';

type Temperament = 'Skittish' | 'Bold' | 'Steady' | 'Erratic';
type HideType = 'Bark' | 'Shell' | 'Scale' | 'Hide' | 'Stone';
type TracksDescriptor = {
  kind: 'prints' | 'feather' | 'furrow' | 'shard' | 'coil';
  toes?: number;
  drag?: boolean;
  stride?: number;
};
type CallDescriptor = {
  waveform: 'sine' | 'square' | 'sawtooth' | 'triangle';
  notes: { freq: number; dur: number }[];
  noise?: number;
};
type SpeciesData = {
  id: string;
  name: string;
  rarity: 'standing' | 'rare';
  tier: 1 | 2 | 3;
  bodyPlan: BodyPlanId;
  hide: HideType;
  innate: ('Swim' | 'Scale')[];
  forces: Force[];
  stats: Record<'vigor' | 'power' | 'speed' | 'focus', [number, number]>;
  temperament: Partial<Record<Temperament, number>>;
  habitat: { region: string; phases: Phase[] }[];
  signatureMoves: {
    name: string;
    delivery: Delivery;
    force: Force;
    power: number;
    speed: number;
  }[];
  tracks: TracksDescriptor;
  hints: { tracks: string; call: string; identified: string };
  call: CallDescriptor;
  palette: { primary: string; secondary: string; accent?: string };
  visual: Record<string, number>;
};
type SpeciesId = SpeciesData['id'];

const bodyPlans = [
  'heavy-quadruped',
  'light-quadruped',
  'avian',
  'amphibious',
  'serpentine',
  'shelled',
  'crawler',
  'large-biped',
];
const hides = ['Bark', 'Shell', 'Scale', 'Hide', 'Stone'];
const forces = ['Impact', 'Cut', 'Heat', 'Surge'];
const deliveries = ['Strike', 'Lunge', 'Bolt', 'Arc', 'Sweep'];
const temperaments: readonly Temperament[] = ['Skittish', 'Bold', 'Steady', 'Erratic'];
const phases: readonly Phase[] = ['Dawn', 'Day', 'Dusk', 'Night'];
const statNames = ['vigor', 'power', 'speed', 'focus'] as const;
const tierBands = {
  1: { vigor: [40, 80], power: [2, 4], speed: [3, 7], focus: [30, 50] },
  2: { vigor: [120, 200], power: [4, 7], speed: [3, 7], focus: [40, 70] },
  3: { vigor: [350, 450], power: [8, 10], speed: [4, 6], focus: [80, 100] },
} as const;
const fields = [
  'id',
  'name',
  'rarity',
  'tier',
  'bodyPlan',
  'hide',
  'innate',
  'forces',
  'stats',
  'temperament',
  'habitat',
  'signatureMoves',
  'tracks',
  'hints',
  'call',
  'palette',
  'visual',
];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const number = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const oneOf = (value: unknown, values: readonly unknown[]): boolean => values.includes(value);
const exactFields = (value: Record<string, unknown>, expected: readonly string[]): boolean =>
  Object.keys(value).length === expected.length && expected.every((field) => field in value);

const validateSpecies = (value: unknown, regionIds: readonly string[]): string[] => {
  const problems: string[] = [];
  if (!Array.isArray(value)) return ['species data must be an array'];
  const seen = new Set<string>();
  value.forEach((raw, index) => {
    const at = `species[${index}]`;
    if (!isRecord(raw) || !exactFields(raw, fields)) {
      problems.push(`${at} must contain exactly the required fields`);
      if (!isRecord(raw)) return;
    }
    const id = typeof raw.id === 'string' ? raw.id : `<entry ${index}>`;
    if (typeof raw.id !== 'string' || !/^[a-z]+(?:-[a-z]+)*$/.test(raw.id))
      problems.push(`${at}.id must be lower-kebab text`);
    else if (seen.has(raw.id)) problems.push(`duplicate species id: ${raw.id}`);
    else seen.add(raw.id);
    if (typeof raw.name !== 'string' || raw.name.length === 0)
      problems.push(`${id}.name must be non-empty text`);
    if (!oneOf(raw.rarity, ['standing', 'rare'])) problems.push(`${id}.rarity is invalid`);
    if (!oneOf(raw.tier, [1, 2, 3])) problems.push(`${id}.tier is invalid`);
    if (!oneOf(raw.bodyPlan, bodyPlans)) problems.push(`${id}.bodyPlan is invalid`);
    if (!oneOf(raw.hide, hides)) problems.push(`${id}.hide is invalid`);
    if (!Array.isArray(raw.innate) || !raw.innate.every((x) => oneOf(x, ['Swim', 'Scale'])))
      problems.push(`${id}.innate is invalid`);
    if (
      !Array.isArray(raw.forces) ||
      raw.forces.length === 0 ||
      !raw.forces.every((x) => oneOf(x, forces))
    )
      problems.push(`${id}.forces is invalid`);

    if (!isRecord(raw.stats)) problems.push(`${id}.stats must be an object`);
    else
      for (const stat of statNames) {
        const range = raw.stats[stat];
        if (!Array.isArray(range) || range.length !== 2 || !range.every(number))
          problems.push(`${id}.stats.${stat} must be a numeric pair`);
        else {
          if (range[0]! > range[1]!) problems.push(`${id}.stats.${stat} minimum exceeds maximum`);
          const tier = raw.tier;
          if (oneOf(tier, [1, 2, 3])) {
            const band = tierBands[tier as 1 | 2 | 3][stat];
            // §13.2 makes Glasswing Speed 7–8; it alone overrides the §5.2 tier-2 band.
            const allowedException = raw.id === 'glasswing' && stat === 'speed';
            if (!allowedException && (range[0]! < band[0] || range[1]! > band[1]))
              problems.push(`${id}.stats.${stat} is outside its tier band`);
          }
        }
      }

    if (!isRecord(raw.temperament)) problems.push(`${id}.temperament must be an object`);
    else {
      const entries = Object.entries(raw.temperament);
      if (
        entries.length === 0 ||
        entries.some(([key, weight]) => !oneOf(key, temperaments) || !number(weight) || weight <= 0)
      )
        problems.push(`${id}.temperament has an invalid weight`);
      const sum = entries.reduce((total, [, weight]) => total + (number(weight) ? weight : 0), 0);
      if (Math.abs(sum - 1) > 0.001)
        problems.push(`${id}.temperament weights sum to ${sum}, not 1`);
    }

    if (!Array.isArray(raw.habitat) || raw.habitat.length === 0)
      problems.push(`${id}.habitat must be non-empty`);
    else
      raw.habitat.forEach((entry, habitatIndex) => {
        if (!isRecord(entry) || typeof entry.region !== 'string' || !Array.isArray(entry.phases))
          problems.push(`${id}.habitat[${habitatIndex}] is invalid`);
        else {
          if (!regionIds.includes(entry.region))
            problems.push(`${id}.habitat has unknown region ${entry.region}`);
          if (entry.phases.length === 0 || !entry.phases.every((phase) => oneOf(phase, phases)))
            problems.push(`${id}.habitat[${habitatIndex}].phases is invalid or empty`);
        }
      });
    if (!Array.isArray(raw.signatureMoves)) problems.push(`${id}.signatureMoves must be an array`);
    else
      raw.signatureMoves.forEach((move, moveIndex) => {
        if (
          !isRecord(move) ||
          !exactFields(move, ['name', 'delivery', 'force', 'power', 'speed']) ||
          typeof move.name !== 'string' ||
          !oneOf(move.delivery, deliveries) ||
          !oneOf(move.force, forces) ||
          !number(move.power) ||
          !number(move.speed)
        )
          problems.push(`${id}.signatureMoves[${moveIndex}] is invalid`);
        else {
          if (!Array.isArray(raw.forces) || !raw.forces.includes(move.force))
            problems.push(`${id}.signatureMoves[${moveIndex}] uses an unavailable force`);
          if (move.power < 1 || move.power > 10)
            problems.push(`${id}.signatureMoves[${moveIndex}].power is outside 1–10`);
          if (move.speed < 1 || move.speed > 5)
            problems.push(`${id}.signatureMoves[${moveIndex}].speed is outside 1–5`);
        }
      });
    if (
      !isRecord(raw.tracks) ||
      !oneOf(raw.tracks.kind, ['prints', 'feather', 'furrow', 'shard', 'coil']) ||
      (raw.tracks.toes !== undefined && !number(raw.tracks.toes)) ||
      (raw.tracks.drag !== undefined && typeof raw.tracks.drag !== 'boolean') ||
      (raw.tracks.stride !== undefined && !number(raw.tracks.stride))
    )
      problems.push(`${id}.tracks is invalid`);
    const hints = raw.hints;
    if (
      !isRecord(hints) ||
      !['tracks', 'call', 'identified'].every((key) => typeof hints[key] === 'string')
    )
      problems.push(`${id}.hints is invalid`);
    if (
      !isRecord(raw.call) ||
      !oneOf(raw.call.waveform, ['sine', 'square', 'sawtooth', 'triangle']) ||
      !Array.isArray(raw.call.notes) ||
      raw.call.notes.length === 0 ||
      !raw.call.notes.every(
        (note) =>
          isRecord(note) && number(note.freq) && note.freq > 0 && number(note.dur) && note.dur > 0,
      ) ||
      (raw.call.noise !== undefined &&
        (!number(raw.call.noise) || raw.call.noise < 0 || raw.call.noise > 1))
    )
      problems.push(`${id}.call is invalid`);
    const hex = /^#[0-9a-f]{6}$/;
    if (
      !isRecord(raw.palette) ||
      !hex.test(String(raw.palette.primary)) ||
      !hex.test(String(raw.palette.secondary)) ||
      (raw.palette.accent !== undefined && !hex.test(String(raw.palette.accent)))
    )
      problems.push(`${id}.palette must contain #rrggbb colours`);
    if (
      !isRecord(raw.visual) ||
      !Object.values(raw.visual).every(number) ||
      !number(raw.visual.length) ||
      raw.visual.length <= 0 ||
      !number(raw.visual.height) ||
      raw.visual.height <= 0
    )
      problems.push(`${id}.visual must have positive length and height`);
  });
  return problems;
};

const regionIds = regions().map(({ id }) => id);
const validationProblems = validateSpecies(speciesJson, regionIds);
if (validationProblems.length > 0)
  throw new Error(`Invalid species data:\n${validationProblems.join('\n')}`);
const data = speciesJson as unknown as SpeciesData[];
const byId = new Map(data.map((entry) => [entry.id, entry]));
const species = (): readonly SpeciesData[] => data;
const speciesById = (id: string): SpeciesData | null => byId.get(id) ?? null;
const isEligible = (speciesId: string, regionId: string, phase: Phase): boolean => {
  if (!regionIds.includes(regionId)) return false;
  // M1 treats Kelpmaw's Long Island grotto as plain eligibility; the Sea Cave Wall gate arrives in M5.
  return (
    speciesById(speciesId)?.habitat.some(
      (entry) => entry.region === regionId && entry.phases.includes(phase),
    ) ?? false
  );
};

export { isEligible, species, speciesById, validateSpecies };
export type {
  BodyPlanId,
  CallDescriptor,
  HideType,
  SpeciesData,
  SpeciesId,
  Temperament,
  TracksDescriptor,
};
