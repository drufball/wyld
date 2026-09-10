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
// "Stone hide — shrugs off Impact, fears Surge"
const hideLine = (hide: HideType): string =>
  `${hide} hide — shrugs off ${resistance(hide)}, fears ${weakness(hide)}`;
const hideMultiplier = (hide: HideType, force: Force): number =>
  force === weakness(hide) ? 1.6 : force === resistance(hide) ? 0.6 : 1;
export { hideLine, hideMultiplier, resistance, weakness };
