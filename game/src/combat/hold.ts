import type { Temperament } from '../creatures/species.js';
import { shotHolds } from './formation.js';

type ShotHoldInput = {
  temperament: Temperament;
  needsLine: boolean;
  lastStanding: boolean;
  distanceTiles: number;
  enemyReachTiles: number;
};

// A frightened creature keeps its shot until it is back outside the enemy's reach plus the release
// margin — unless it is the last one out, when it fights with whatever it has.
const shotHeld = (input: ShotHoldInput): boolean =>
  input.temperament === 'Skittish' &&
  input.needsLine &&
  !input.lastStanding &&
  shotHolds(input.distanceTiles, input.enemyReachTiles);

export { shotHeld };
export type { ShotHoldInput };
