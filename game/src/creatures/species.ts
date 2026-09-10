import { validateSpecies, type BodyPlanId, type SpeciesData } from '@wyld/sprites';
import speciesJson from '../data/species.json';
import { regions } from '../world/regions.js';

type Temperament = keyof SpeciesData['temperament'];
type HideType = SpeciesData['hide'];
type TracksDescriptor = SpeciesData['tracks'];
type CallDescriptor = SpeciesData['call'];
type SpeciesId = SpeciesData['id'];
type Force = SpeciesData['forces'][number];
type Phase = SpeciesData['habitat'][number]['phases'][number];

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

export { forces, hides, isEligible, species, speciesById };
export type {
  BodyPlanId,
  CallDescriptor,
  HideType,
  SpeciesData,
  SpeciesId,
  Temperament,
  TracksDescriptor,
};
