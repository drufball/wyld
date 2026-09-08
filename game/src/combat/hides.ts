import type { Force } from './moves.js';
import type { HideType } from '../creatures/species.js';

const table: Record<HideType, readonly [Force, Force]> = {
  Bark: ['Heat', 'Cut'],
  Shell: ['Impact', 'Cut'],
  Scale: ['Surge', 'Heat'],
  Hide: ['Cut', 'Surge'],
  Stone: ['Surge', 'Impact'],
};
const weakness = (hide: HideType): Force => table[hide][0];
const resistance = (hide: HideType): Force => table[hide][1];
const hideMultiplier = (hide: HideType, force: Force): number =>
  force === weakness(hide) ? 1.6 : force === resistance(hide) ? 0.6 : 1;
export { hideMultiplier, resistance, weakness };
