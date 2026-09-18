import { hideMultiplier } from './hides.js';
import type { HideType } from '../creatures/species.js';
import type { Delivery, Move } from './moves.js';

type DeliveryRules = {
  range: number;
  area: 'single' | '3m-radius' | '120deg-cone';
  windup: number;
  cooldown: number;
  focus: number;
};

const deliveries: Record<Delivery, DeliveryRules> = {
  Strike: { range: 2.5, area: 'single', windup: 0.6, cooldown: 2, focus: 6 },
  Lunge: { range: 8, area: 'single', windup: 0.8, cooldown: 4, focus: 10 },
  Bolt: { range: 20, area: 'single', windup: 0.9, cooldown: 3, focus: 8 },
  Arc: { range: 15, area: '3m-radius', windup: 1.2, cooldown: 6, focus: 12 },
  Sweep: { range: 4, area: '120deg-cone', windup: 1, cooldown: 5, focus: 10 },
};

const metresToTiles = (metres: number): number => metres / 2;
const windup = (move: Move, speedStat: number): number =>
  Math.max(
    0.25,
    deliveries[move.delivery].windup * (1.2 - speedStat * 0.06) * (1 - move.speed * 0.1),
  );
const damage = (
  move: Move,
  attackerPower: number,
  defenderHide: HideType,
  ambushMultiplier = 1,
): number =>
  Math.max(
    1,
    Math.round(
      move.power *
        5 *
        (0.6 + attackerPower / 10) *
        hideMultiplier(defenderHide, move.force) *
        ambushMultiplier +
        1e-9,
    ),
  );
const canAfford = (focus: number, move: Move): boolean => focus >= deliveries[move.delivery].focus;
const cooldownFor = (move: Move): number => deliveries[move.delivery].cooldown * move.cooldownMult;
const rangeFor = (move: Move): number => deliveries[move.delivery].range * move.rangeMult;
const rangeTilesFor = (move: Move): number => metresToTiles(rangeFor(move));

export { canAfford, cooldownFor, damage, deliveries, metresToTiles, rangeTilesFor, windup };
export type { DeliveryRules };
