import type { Force } from '../combat/moves.js';
import {
  species,
  speciesById,
  type HideType,
  type SpeciesData,
  type Temperament,
} from '../creatures/species.js';
import { regions } from '../world/regions.js';
import type { Phase } from '../world/time.js';
import { createFog, type Fog } from './fog.js';

type Position = { x: number; y: number; z: number };
type LocatedDay = { region: string | null; day: number };
type Sighting = LocatedDay & { position: Position; phase: Phase };
type Rumour = LocatedDay;
type Stub = LocatedDay & {
  id: string;
  speciesId: string;
  slot: 'tracks' | 'call';
  hint: string;
};
type Page = {
  speciesId: string;
  tracks: LocatedDay | null;
  call: LocatedDay | null;
  identified: boolean;
  name: string | null;
  habitat: string[];
  phases: Phase[];
  sightings: Sighting[];
  hide: HideType | null;
  weakness: Force | null;
  resistance: Force | null;
  moves: string[];
  temperaments: Temperament[];
  captured: boolean;
  rumours: Rumour[];
};
type PageJSON = Page;
type NotebookJSON = {
  schemaVersion: 1;
  pages: PageJSON[];
  stubs: Stub[];
  completedAt: string | null;
  fog: number[];
  camps: string[];
};
type Observation = LocatedDay & { phase: Phase; position: Position };
type RecordResult = { recorded: boolean; stub: Stub | null };
type Notebook = {
  recordTracks(speciesId: string, fact: LocatedDay): RecordResult;
  recordCall(speciesId: string, fact: LocatedDay): RecordResult;
  identify(speciesId: string, observation: Observation): { identified: boolean; merged: number };
  recordSighting(speciesId: string, observation: Observation): boolean;
  recordHide(speciesId: string, hide: HideType): boolean;
  recordWeakness(speciesId: string, force: Force): boolean;
  recordResistance(speciesId: string, force: Force): boolean;
  recordMove(speciesId: string, moveName: string): boolean;
  recordTemperament(speciesId: string, temperament: Temperament): boolean;
  recordCapture(speciesId: string): boolean;
  recordRumour(speciesId: string, rumour: Rumour): boolean;
  page(speciesId: string): Page | null;
  pages(): readonly Page[];
  stubs(): readonly Stub[];
  completion(speciesId: string): boolean;
  completionFraction(speciesId: string): { have: number; total: number };
  overallCompletion(): number;
  isComplete(): boolean;
  finalPage(): { text: string; completedAt: string } | null;
  closingText(): string;
  revealFog(x: number, z: number): number[];
  fog(): Fog;
  revealAllFog(): void;
  discoverCamp(campId: string): boolean;
  discoveredCamps(): readonly string[];
  toJSON(): NotebookJSON;
};

const CLOSING_TEXT =
  'Thirteen pages, and none of them empty. I arrived knowing one creature and guessing at the rest; I learned the others the slow way, by prints in wet ground and by sounds I could not place for weeks. The rim still smokes after dark and the reeds still answer at dusk, and none of it was ever waiting on me to write it down. I will keep walking, but the book is finished.';
const phases: readonly Phase[] = ['Dawn', 'Day', 'Dusk', 'Night'];
const hides: readonly HideType[] = ['Bark', 'Shell', 'Scale', 'Hide', 'Stone'];
const forces: readonly Force[] = ['Impact', 'Cut', 'Heat', 'Surge'];
const temperaments: readonly Temperament[] = ['Skittish', 'Bold', 'Steady', 'Erratic'];

const emptyPage = (speciesId: string): Page => ({
  speciesId,
  tracks: null,
  call: null,
  identified: false,
  name: null,
  habitat: [],
  phases: [],
  sightings: [],
  hide: null,
  weakness: null,
  resistance: null,
  moves: [],
  temperaments: [],
  captured: false,
  rumours: [],
});

const requiredSpecies = (id: string): SpeciesData => {
  const found = speciesById(id);
  if (found === null) throw new Error(`Unknown species: ${id}`);
  return found;
};

const pushUnique = <T>(values: T[], value: T): boolean => {
  if (values.includes(value)) return false;
  values.push(value);
  return true;
};

const stubTitle = (stub: Stub): string => {
  const entry = requiredSpecies(stub.speciesId);
  let descriptor = '';
  if (stub.slot === 'tracks') {
    const parts: string[] = [];
    if (entry.tracks.kind !== 'prints') parts.push(entry.tracks.kind);
    if (entry.tracks.toes !== undefined) parts.push(`${entry.tracks.toes}-toed`);
    if (entry.tracks.drag === true) parts.push('dragging');
    if (entry.tracks.stride !== undefined) parts.push(`stride ${entry.tracks.stride}`);
    descriptor = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
  }
  const region = stub.region === null ? null : regions().find(({ id }) => id === stub.region);
  const place = region
    ? ` — ${region.biome[0]!.toUpperCase()}${region.biome.slice(1)} (${region.name})`
    : '';
  return `Unknown ${stub.slot === 'tracks' ? (entry.tracks.kind === 'prints' ? 'tracks' : 'sign') : 'call'}${descriptor}${place}`;
};

const createNotebookState = (
  initialPages: Page[] = [],
  initialStubs: Stub[] = [],
  initialCompletedAt: string | null = null,
  initialFog: readonly number[] = [],
  initialCamps: readonly string[] = [],
): Notebook => {
  const records = new Map(initialPages.map((page) => [page.speciesId, page]));
  const unknownFacts = initialStubs;
  let completedAt = initialCompletedAt;
  const fog = createFog(initialFog);
  const discovered = new Set(initialCamps);
  const get = (id: string): Page => {
    requiredSpecies(id);
    let value = records.get(id);
    if (value === undefined) {
      value = emptyPage(id);
      records.set(id, value);
    }
    return value;
  };
  const fraction = (id: string): { have: number; total: number } => {
    const definition = requiredSpecies(id);
    const page = records.get(id);
    const checks = [
      page?.identified,
      page?.tracks !== null && page?.tracks !== undefined,
      page?.call !== null && page?.call !== undefined,
      page?.hide !== null && page?.hide !== undefined,
      page?.weakness !== null && page?.weakness !== undefined,
      page?.resistance !== null && page?.resistance !== undefined,
      (page?.habitat.length ?? 0) > 0,
      (page?.phases.length ?? 0) > 0,
      (page?.temperaments.length ?? 0) > 0,
      page?.captured,
      ...definition.signatureMoves.map((move) => page?.moves.includes(move.name)),
    ];
    return { have: checks.filter(Boolean).length, total: 10 + definition.signatureMoves.length };
  };
  const complete = (id: string): boolean => {
    const value = fraction(id);
    return value.have === value.total;
  };
  const overall = (): number =>
    species().filter(({ id }) => complete(id)).length / species().length;
  const stampIfComplete = (): void => {
    if (completedAt === null && overall() === 1) completedAt = new Date().toISOString();
  };
  const setOnce = <K extends 'hide' | 'weakness' | 'resistance'>(
    id: string,
    key: K,
    value: Page[K],
  ): boolean => {
    const page = get(id);
    if (page[key] !== null) return false;
    page[key] = value;
    stampIfComplete();
    return true;
  };
  const recordEvidence = (id: string, slot: 'tracks' | 'call', fact: LocatedDay): RecordResult => {
    const definition = requiredSpecies(id);
    const page = get(id);
    if (page[slot] !== null) return { recorded: false, stub: null };
    page[slot] = { ...fact };
    let stub: Stub | null = null;
    if (!page.identified) {
      stub = {
        id: `${id}:${slot}`,
        speciesId: id,
        slot,
        hint: definition.hints[slot],
        ...fact,
      };
      unknownFacts.push(stub);
    }
    stampIfComplete();
    return { recorded: true, stub };
  };
  const api: Notebook = {
    recordTracks: (id, fact) => recordEvidence(id, 'tracks', fact),
    recordCall: (id, fact) => recordEvidence(id, 'call', fact),
    identify(id, observation) {
      const definition = requiredSpecies(id);
      const page = get(id);
      if (page.identified) {
        api.recordSighting(id, observation);
        return { identified: false, merged: 0 };
      }
      page.identified = true;
      page.name = definition.name;
      api.recordSighting(id, observation);
      let merged = 0;
      for (let index = unknownFacts.length - 1; index >= 0; index -= 1) {
        if (unknownFacts[index]!.speciesId === id) {
          unknownFacts.splice(index, 1);
          merged += 1;
        }
      }
      stampIfComplete();
      return { identified: true, merged };
    },
    recordSighting(id, observation) {
      const page = get(id);
      page.sightings.push(structuredClone(observation));
      if (page.sightings.length > 20) page.sightings.shift();
      pushUnique(page.phases, observation.phase);
      // Later sightings refine habitat as well as the first identification sighting.
      if (observation.region !== null) pushUnique(page.habitat, observation.region);
      stampIfComplete();
      return true;
    },
    recordHide: (id, hide) => setOnce(id, 'hide', hide),
    recordWeakness: (id, force) => setOnce(id, 'weakness', force),
    recordResistance: (id, force) => setOnce(id, 'resistance', force),
    recordMove(id, move) {
      const changed = pushUnique(get(id).moves, move);
      if (changed) stampIfComplete();
      return changed;
    },
    recordTemperament(id, temperament) {
      const changed = pushUnique(get(id).temperaments, temperament);
      if (changed) stampIfComplete();
      return changed;
    },
    recordCapture(id) {
      const page = get(id);
      if (page.captured) return false;
      page.captured = true;
      stampIfComplete();
      return true;
    },
    recordRumour(id, rumour) {
      const page = get(id);
      page.rumours.push({ ...rumour });
      if (page.rumours.length > 10) page.rumours.shift();
      return true;
    },
    page: (id) => (records.get(id)?.identified === true ? structuredClone(records.get(id)!) : null),
    pages: () => structuredClone([...records.values()].filter(({ identified }) => identified)),
    stubs: () => structuredClone(unknownFacts),
    completion: complete,
    completionFraction: fraction,
    overallCompletion: overall,
    isComplete: () => overall() === 1,
    finalPage() {
      stampIfComplete();
      return overall() !== 1 || completedAt === null ? null : { text: CLOSING_TEXT, completedAt };
    },
    closingText: () => CLOSING_TEXT,
    revealFog: (x, z) => fog.reveal(x, z),
    fog: () => fog,
    revealAllFog: () => fog.revealAll(),
    discoverCamp(campId) {
      if (discovered.has(campId)) return false;
      discovered.add(campId);
      return true;
    },
    discoveredCamps: () => [...discovered].sort(),
    toJSON: () => ({
      schemaVersion: 1,
      pages: structuredClone([...records.values()]),
      stubs: structuredClone(unknownFacts),
      completedAt,
      fog: fog.toJSON(),
      camps: [...discovered].sort(),
    }),
  };
  return api;
};

const createEmptyNotebook = (): Notebook => createNotebookState();

const createNotebook = (): Notebook => {
  const notebook = createEmptyNotebook();
  const loamox = requiredSpecies('loamox');
  notebook.recordTracks(loamox.id, { region: 'hollow', day: 0 });
  notebook.recordCall(loamox.id, { region: 'hollow', day: 0 });
  // Day zero is rendered as "before the journal began" by the field guide UI.
  notebook.identify(loamox.id, {
    region: 'hollow',
    phase: 'Day',
    position: { x: -146, y: 0, z: 54 },
    day: 0,
  });
  notebook.recordSighting(loamox.id, {
    region: 'hollow',
    phase: 'Dusk',
    position: { x: -157, y: 0, z: 44 },
    day: 0,
  });
  notebook.recordHide(loamox.id, loamox.hide);
  notebook.recordWeakness(loamox.id, 'Cut');
  notebook.recordResistance(loamox.id, 'Surge');
  loamox.signatureMoves.forEach(({ name }) => notebook.recordMove(loamox.id, name));
  notebook.recordTemperament(loamox.id, 'Steady');
  notebook.recordCapture(loamox.id);
  return notebook;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const isLocatedDay = (value: unknown): value is LocatedDay =>
  isObject(value) && hasLocatedDay(value);
const hasLocatedDay = (value: Record<string, unknown>): boolean =>
  (value.region === null || typeof value.region === 'string') &&
  typeof value.day === 'number' &&
  Number.isFinite(value.day);
const isPage = (value: unknown): value is Page => {
  if (!isObject(value) || speciesById(String(value.speciesId)) === null) return false;
  const sighting = (item: unknown): boolean => {
    if (!isObject(item) || !hasLocatedDay(item) || !isObject(item.position)) return false;
    const position = item.position;
    return (
      phases.includes(item.phase as Phase) &&
      ['x', 'y', 'z'].every(
        (axis) => typeof position[axis] === 'number' && Number.isFinite(position[axis]),
      )
    );
  };
  return (
    (value.tracks === null || isLocatedDay(value.tracks)) &&
    (value.call === null || isLocatedDay(value.call)) &&
    typeof value.identified === 'boolean' &&
    (value.name === null || typeof value.name === 'string') &&
    isStringArray(value.habitat) &&
    Array.isArray(value.phases) &&
    value.phases.every((x) => phases.includes(x as Phase)) &&
    Array.isArray(value.sightings) &&
    value.sightings.length <= 20 &&
    value.sightings.every(sighting) &&
    (value.hide === null || hides.includes(value.hide as HideType)) &&
    (value.weakness === null || forces.includes(value.weakness as Force)) &&
    (value.resistance === null || forces.includes(value.resistance as Force)) &&
    isStringArray(value.moves) &&
    Array.isArray(value.temperaments) &&
    value.temperaments.every((x) => temperaments.includes(x as Temperament)) &&
    typeof value.captured === 'boolean' &&
    Array.isArray(value.rumours) &&
    value.rumours.length <= 10 &&
    value.rumours.every(isLocatedDay)
  );
};
const isStub = (value: unknown): value is Stub =>
  isObject(value) &&
  hasLocatedDay(value) &&
  typeof value.id === 'string' &&
  typeof value.speciesId === 'string' &&
  speciesById(value.speciesId) !== null &&
  (value.slot === 'tracks' || value.slot === 'call') &&
  typeof value.hint === 'string';

const notebookFromJSON = (value: unknown): Notebook => {
  if (!isObject(value)) throw new Error('Invalid notebook: expected an object');
  if (value.schemaVersion !== 1)
    throw new Error(`Unsupported notebook schemaVersion: ${String(value.schemaVersion)}`);
  if (
    !Array.isArray(value.pages) ||
    !value.pages.every(isPage) ||
    !Array.isArray(value.stubs) ||
    !value.stubs.every(isStub) ||
    (value.fog !== undefined &&
      (!Array.isArray(value.fog) ||
        !value.fog.every((index) => Number.isInteger(index) && index >= 0 && index < 1600))) ||
    (value.camps !== undefined && !isStringArray(value.camps)) ||
    (value.completedAt !== null && typeof value.completedAt !== 'string')
  )
    throw new Error('Invalid notebook: malformed shape');
  return createNotebookState(
    structuredClone(value.pages),
    structuredClone(value.stubs),
    value.completedAt,
    value.fog === undefined ? [] : (value.fog as number[]),
    value.camps === undefined ? [] : (value.camps as string[]),
  );
};

export { createEmptyNotebook, createNotebook, notebookFromJSON, stubTitle };
export type { Notebook, NotebookJSON, Page, PageJSON, Position, Rumour, Sighting, Stub };
