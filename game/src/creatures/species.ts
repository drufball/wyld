import { validateSpecies, type BodyPlanId } from '@wyld/sprites';
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

const forces = ['Impact', 'Cut', 'Heat', 'Surge'] as const satisfies readonly Force[];
const hides = ['Bark', 'Shell', 'Scale', 'Hide', 'Stone'] as const satisfies readonly HideType[];
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

export { forces, hides, isEligible, species, speciesById, validateSpecies };
export type {
  BodyPlanId,
  CallDescriptor,
  HideType,
  SpeciesData,
  SpeciesId,
  Temperament,
  TracksDescriptor,
};
