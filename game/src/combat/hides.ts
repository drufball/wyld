import type { Force } from './moves.js';
import type { HideType } from '../creatures/species.js';

const table: Record<HideType, readonly [Force, Force]> = {
  Bark: ['Heat', 'Cut'],
  Shell: ['Impact', 'Cut'],
  Scale: ['Surge', 'Heat'],
  Hide: ['Cut', 'Surge'],
  Stone: ['Surge', 'Impact'],
};
const WEAKNESS_MULTIPLIER = 1.6;
const RESISTANCE_MULTIPLIER = 0.6;
const weakness = (hide: HideType): Force => table[hide][0];
const resistance = (hide: HideType): Force => table[hide][1];
const shrugsOffLine = (hide: HideType): string => `shrugs off ${resistance(hide)}`;

// One of the hide types is itself called "Hide", so it does not take the word twice.
const hideLine = (hide: HideType): string =>
  `${hide === 'Hide' ? 'Hide' : `${hide} hide`} — ${shrugsOffLine(hide)}, fears ${weakness(hide)}`;
const hideMultiplier = (hide: HideType, force: Force): number =>
  force === weakness(hide)
    ? WEAKNESS_MULTIPLIER
    : force === resistance(hide)
      ? RESISTANCE_MULTIPLIER
      : 1;
export {
  hideLine,
  hideMultiplier,
  resistance,
  RESISTANCE_MULTIPLIER,
  shrugsOffLine,
  weakness,
  WEAKNESS_MULTIPLIER,
};
