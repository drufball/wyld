export const BODY_PLANS = [
  'heavy-quadruped',
  'light-quadruped',
  'avian',
  'amphibious',
  'serpentine',
  'shelled',
  'crawler',
  'large-biped',
] as const;
export const HIDES = ['Bark', 'Shell', 'Scale', 'Hide', 'Stone'] as const;
export const FORCES = ['Impact', 'Cut', 'Heat', 'Surge'] as const;
export const DELIVERIES = ['Strike', 'Lunge', 'Bolt', 'Arc', 'Sweep'] as const;
export const TEMPERAMENTS = ['Skittish', 'Bold', 'Steady', 'Erratic'] as const;
export const PHASES = ['Dawn', 'Day', 'Dusk', 'Night'] as const;
export const RARITIES = ['standing', 'rare'] as const;
export const INNATE = ['Swim', 'Scale'] as const;
export const STAT_NAMES = ['vigor', 'power', 'speed', 'focus'] as const;
export const TRACK_KINDS = ['prints', 'feather', 'furrow', 'shard', 'coil'] as const;
export const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'] as const;
export type BodyPlanId = (typeof BODY_PLANS)[number];
export type HideType = (typeof HIDES)[number];
export type Force = (typeof FORCES)[number];
export type Delivery = (typeof DELIVERIES)[number];
export type Temperament = (typeof TEMPERAMENTS)[number];
export type Phase = (typeof PHASES)[number];
export type StatName = (typeof STAT_NAMES)[number];
export const TIER_BANDS = {
  1: { vigor: [40, 80], power: [2, 4], speed: [3, 7], focus: [30, 50] },
  2: { vigor: [120, 200], power: [4, 7], speed: [3, 7], focus: [40, 70] },
  3: { vigor: [350, 450], power: [8, 10], speed: [4, 6], focus: [80, 100] },
} as const;
export const HIDE_TABLE: Record<HideType, { weak: Force; resists: Force }> = {
  Bark: { weak: 'Heat', resists: 'Cut' },
  Shell: { weak: 'Impact', resists: 'Cut' },
  Scale: { weak: 'Surge', resists: 'Heat' },
  Hide: { weak: 'Cut', resists: 'Surge' },
  Stone: { weak: 'Surge', resists: 'Impact' },
};
export const BODY_PLAN_DELIVERIES: Record<BodyPlanId, readonly Delivery[]> = {
  'heavy-quadruped': ['Strike', 'Lunge', 'Sweep'],
  'light-quadruped': ['Strike', 'Lunge', 'Bolt'],
  avian: ['Bolt', 'Arc', 'Lunge'],
  amphibious: ['Strike', 'Bolt', 'Sweep'],
  serpentine: ['Strike', 'Lunge', 'Sweep', 'Bolt'],
  shelled: ['Strike', 'Sweep'],
  crawler: ['Strike', 'Sweep', 'Arc'],
  'large-biped': ['Strike', 'Lunge', 'Sweep', 'Arc', 'Bolt'],
};
