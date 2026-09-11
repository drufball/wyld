import type { Temperament } from '../creatures/species.js';

const AUTHORITY_FULL_TILES = 2;
const AUTHORITY_ZERO_TILES: Readonly<Record<Temperament, number>> = {
  Steady: 8,
  Bold: 8,
  Skittish: 6,
  Erratic: 4,
};
const AUTOPILOT_YIELD_AUTHORITY = 0.5;
const MOVE_TAP_AUTHORITY_FLOOR = 0.15;
const moveTapAuthority = (authorityValue: number): number =>
  Math.max(MOVE_TAP_AUTHORITY_FLOOR, authorityValue);

const authority = (distanceTiles: number, temperament: Temperament): number => {
  if (Number.isNaN(distanceTiles) || distanceTiles <= AUTHORITY_FULL_TILES) return 1;
  const zero = AUTHORITY_ZERO_TILES[temperament];
  return Math.max(0, Math.min(1, (zero - distanceTiles) / (zero - AUTHORITY_FULL_TILES)));
};
const hears = (authorityValue: number, roll: number): boolean => roll < authorityValue;
const autopilotHolds = (authorityValue: number): boolean =>
  authorityValue >= AUTOPILOT_YIELD_AUTHORITY;

export {
  AUTHORITY_FULL_TILES,
  AUTHORITY_ZERO_TILES,
  AUTOPILOT_YIELD_AUTHORITY,
  authority,
  autopilotHolds,
  hears,
  MOVE_TAP_AUTHORITY_FLOOR,
  moveTapAuthority,
};
