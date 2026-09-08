import {
  BODY_PLAN_DELIVERIES,
  BODY_PLANS,
  DELIVERIES,
  FORCES,
  HIDES,
  INNATE,
  PHASES,
  RARITIES,
  STAT_NAMES,
  TEMPERAMENTS,
  TIER_BANDS,
  TRACK_KINDS,
  WAVEFORMS,
  type BodyPlanId,
  type Delivery,
  type StatName,
} from './species.js';

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

export const validateSpecies = (value: unknown, regionIds: readonly string[]): string[] => {
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
    if (!oneOf(raw.rarity, RARITIES)) problems.push(`${id}.rarity is invalid`);
    if (!oneOf(raw.tier, [1, 2, 3])) problems.push(`${id}.tier is invalid`);
    if (!oneOf(raw.bodyPlan, BODY_PLANS)) problems.push(`${id}.bodyPlan is invalid`);
    if (!oneOf(raw.hide, HIDES)) problems.push(`${id}.hide is invalid`);
    if (!Array.isArray(raw.innate) || !raw.innate.every((x) => oneOf(x, INNATE)))
      problems.push(`${id}.innate is invalid`);
    if (
      !Array.isArray(raw.forces) ||
      raw.forces.length === 0 ||
      !raw.forces.every((x) => oneOf(x, FORCES))
    )
      problems.push(`${id}.FORCES is invalid`);

    if (!isRecord(raw.stats)) problems.push(`${id}.stats must be an object`);
    else
      for (const stat of STAT_NAMES) {
        const range = raw.stats[stat];
        if (!Array.isArray(range) || range.length !== 2 || !range.every(number))
          problems.push(`${id}.stats.${stat} must be a numeric pair`);
        else {
          if (range[0]! > range[1]!) problems.push(`${id}.stats.${stat} minimum exceeds maximum`);
          const tier = raw.tier;
          if (oneOf(tier, [1, 2, 3])) {
            const band = TIER_BANDS[tier as 1 | 2 | 3][stat];
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
        entries.some(([key, weight]) => !oneOf(key, TEMPERAMENTS) || !number(weight) || weight <= 0)
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
          if (entry.phases.length === 0 || !entry.phases.every((phase) => oneOf(phase, PHASES)))
            problems.push(`${id}.habitat[${habitatIndex}].PHASES is invalid or empty`);
        }
      });
    if (!Array.isArray(raw.signatureMoves)) problems.push(`${id}.signatureMoves must be an array`);
    else
      raw.signatureMoves.forEach((move, moveIndex) => {
        if (
          !isRecord(move) ||
          !exactFields(move, ['name', 'delivery', 'force', 'power', 'speed']) ||
          typeof move.name !== 'string' ||
          !oneOf(move.delivery, DELIVERIES) ||
          !oneOf(move.force, FORCES) ||
          !number(move.power) ||
          !number(move.speed)
        )
          problems.push(`${id}.signatureMoves[${moveIndex}] is invalid`);
        else {
          if (!Array.isArray(raw.forces) || !raw.forces.includes(move.force))
            problems.push(`${id}.signatureMoves[${moveIndex}] uses an unavailable force`);
          if (
            oneOf(raw.bodyPlan, BODY_PLANS) &&
            !BODY_PLAN_DELIVERIES[raw.bodyPlan as BodyPlanId].includes(move.delivery as Delivery)
          )
            problems.push(
              `${id}.signatureMoves[${moveIndex}] uses a delivery ${String(raw.bodyPlan)} cannot perform`,
            );
          if (move.power < 1 || move.power > 10)
            problems.push(`${id}.signatureMoves[${moveIndex}].power is outside 1–10`);
          if (move.speed < 1 || move.speed > 5)
            problems.push(`${id}.signatureMoves[${moveIndex}].speed is outside 1–5`);
        }
      });
    if (
      !isRecord(raw.tracks) ||
      !oneOf(raw.tracks.kind, TRACK_KINDS) ||
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
      !oneOf(raw.call.waveform, WAVEFORMS) ||
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
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contains = (text: string, name: string, insensitive: boolean) =>
  new RegExp(`\\b${escaped(name)}\\b`, insensitive ? 'i' : '').test(text);
export const validateHints = (
  entries: readonly { name: string; hints: { tracks: string; call: string; identified: string } }[],
  regionNames: readonly string[],
): string[] => {
  const problems: string[] = [];
  for (const entry of entries) {
    for (const field of ['tracks', 'call', 'identified'] as const) {
      const text = entry.hints[field];
      for (const region of regionNames)
        if (contains(text, region, true))
          problems.push(`${entry.name}.hints.${field} names a region: ${region}`);
      for (const phase of PHASES)
        if (contains(text, phase, false))
          problems.push(`${entry.name}.hints.${field} names a phase: ${phase}`);
      if (field !== 'identified')
        for (const species of entries)
          if (contains(text, species.name, true))
            problems.push(`${entry.name}.hints.${field} names a species: ${species.name}`);
    }
  }
  return problems;
};
export const deliveriesFor = (bodyPlan: BodyPlanId): readonly Delivery[] =>
  BODY_PLAN_DELIVERIES[bodyPlan];
export const bandFor = (tier: 1 | 2 | 3, stat: StatName): readonly [number, number] =>
  TIER_BANDS[tier][stat];
