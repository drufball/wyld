import type { Individual } from '../creatures/individual.js';
import { roll } from '../creatures/individual.js';
import { speciesById } from '../creatures/species.js';
import type { Rng } from '../engine/rng.js';
import type { PathGrid, Point } from '../player/pathing.js';
import { findPath } from '../player/pathing.js';

type PartyMember = {
  individual: Individual;
  name: string;
  tile: Point;
  path: readonly Point[];
};
type WildTarget = { id: string; speciesId: string };
type PartyState = {
  roster: PartyMember[];
  party: PartyMember[];
  selection: 'player' | string;
  target: WildTarget | null;
};

const FORMATION_OFFSETS: readonly Point[] = [
  { tx: 0, ty: 1 },
  { tx: -1, ty: 1 },
  { tx: 1, ty: 1 },
];

const createParty = (owned: readonly PartyMember[]): PartyState => ({
  roster: [...owned],
  party: owned.slice(0, 3),
  selection: 'player',
  target: null,
});
const addPartyMember = (state: PartyState, member: PartyMember): PartyState =>
  state.party.length >= 3
    ? state
    : { ...state, roster: [...state.roster, member], party: [...state.party, member] };
const removePartyMember = (state: PartyState, id: string): PartyState => {
  if (!state.party.some(({ individual }) => individual.id === id)) return state;
  return {
    ...state,
    roster: state.roster.filter(({ individual }) => individual.id !== id),
    party: state.party.filter(({ individual }) => individual.id !== id),
    selection: state.selection === id ? 'player' : state.selection,
  };
};
const createStartingParty = (rng: Rng): PartyState => {
  const individual = roll(speciesById('loamox')!, rng, 'barrow');
  individual.temperament = 'Steady';
  individual.stats = { vigor: 70, power: 3, speed: 4, focus: 40 };
  return createParty([{ individual, name: 'Barrow', tile: { tx: 125, ty: 225 }, path: [] }]);
};
const selectCreature = (state: PartyState, id: string): PartyState =>
  state.party.some(({ individual }) => individual.id === id) ? { ...state, selection: id } : state;
const selectPlayer = (state: PartyState): PartyState => ({ ...state, selection: 'player' });
const targetWildCreature = (state: PartyState, target: WildTarget): PartyState => ({
  ...state,
  target,
});
const groundTapped = (state: PartyState): PartyState => ({ ...state, target: null });
const isRinged = (state: PartyState, id: string): boolean => state.selection === id;
const formationTiles = (player: Point): Point[] =>
  FORMATION_OFFSETS.map(({ tx, ty }) => ({ tx: player.tx + tx, ty: player.ty + ty }));
const followerPath = (grid: PathGrid, follower: Point, offset: Point): readonly Point[] | null =>
  Math.hypot(follower.tx - offset.tx, follower.ty - offset.ty) > 2
    ? findPath(grid, follower, offset)
    : null;

export {
  FORMATION_OFFSETS,
  addPartyMember,
  createParty,
  createStartingParty,
  followerPath,
  formationTiles,
  groundTapped,
  isRinged,
  removePartyMember,
  selectCreature,
  selectPlayer,
  targetWildCreature,
};
export type { PartyMember, PartyState, WildTarget };
