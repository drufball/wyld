import type { Individual } from '../creatures/individual.js';
import type { Temperament } from '../creatures/species.js';
import { shotHolds } from './formation.js';
import { shotHeld } from './hold.js';
import { canAfford, cooldownFor, rangeTilesFor } from './resolve.js';

const STEADY_BEAT_SECONDS = 1;
const ERRATIC_PAUSE_MIN_SECONDS = 0.5;
const ERRATIC_PAUSE_MAX_SECONDS = 1.5;

type Point = { x: number; y: number };
type ChoiceMove = {
  id: string;
  power: number;
  rangeTiles: number;
  cooldownTotal: number;
  cooldownRemaining: number;
  affordable: boolean;
  needsLine: boolean;
};
type ChoiceCreature = {
  id: string;
  temperament: Temperament;
  tile: Point;
  downed: boolean;
  benched: boolean;
  busy: boolean;
  armed: boolean;
  lineToEnemy: boolean;
  moves: readonly ChoiceMove[];
};
type ChoiceInput = {
  now: number;
  enemy: { tile: Point; targetId: string | null; downed: boolean; reachTiles: number };
  creatures: readonly ChoiceCreature[];
};
type Choice = { creatureId: string; moveId: string };

type ChoiceCombatState = {
  elapsed: number;
  enemy: { tile: Point; targetId?: string | null; downed: boolean; reachTiles: number };
  party: readonly {
    id: string;
    tile: Point;
    focus: number;
    downed: boolean;
    benched: boolean;
    windup: unknown | null;
    approaching?: boolean;
    lineToEnemy?: boolean;
    cooldowns: Record<string, { remaining: number }>;
  }[];
};

const choiceInputFrom = (
  combat: ChoiceCombatState,
  party: readonly Individual[],
  armed: (creatureId: string) => boolean = () => false,
): ChoiceInput => ({
  now: combat.elapsed,
  enemy: {
    tile: combat.enemy.tile,
    targetId: combat.enemy.targetId ?? null,
    downed: combat.enemy.downed,
    reachTiles: combat.enemy.reachTiles,
  },
  creatures: combat.party.map((combatant) => {
    const individual = party.find(({ id }) => id === combatant.id);
    if (!individual) throw new Error(`Missing individual for combatant ${combatant.id}`);
    return {
      id: combatant.id,
      temperament: individual.temperament,
      tile: combatant.tile,
      downed: combatant.downed,
      benched: combatant.benched,
      busy: combatant.windup !== null || combatant.approaching === true,
      armed: armed(combatant.id),
      lineToEnemy: combatant.lineToEnemy ?? true,
      moves: individual.repertoire.map((move) => ({
        id: move.id,
        power: move.power,
        rangeTiles: rangeTilesFor(move),
        cooldownTotal: cooldownFor(move),
        cooldownRemaining: combatant.cooldowns[move.id]?.remaining ?? 0,
        affordable: canAfford(combatant.focus, move),
        needsLine: move.delivery === 'Bolt' || move.delivery === 'Arc',
      })),
    };
  }),
});

const createChooser = (rng: () => number) => {
  const nextAllowedAt = new Map<string, number>();
  const choose = (input: ChoiceInput): Choice[] => {
    const choices: Choice[] = [];
    for (const creature of input.creatures) {
      if (
        input.enemy.downed ||
        creature.downed ||
        creature.benched ||
        creature.busy ||
        creature.armed ||
        input.now < (nextAllowedAt.get(creature.id) ?? 0)
      )
        continue;
      let reachable = creature.moves.filter(
        (move) =>
          move.cooldownRemaining <= 0 &&
          move.affordable &&
          (!move.needsLine || creature.lineToEnemy) &&
          Math.hypot(creature.tile.x - input.enemy.tile.x, creature.tile.y - input.enemy.tile.y) <=
            move.rangeTiles,
      );
      if (reachable.length === 0) continue;
      let selected: ChoiceMove | undefined;
      if (creature.temperament === 'Bold')
        selected = [...reachable].sort(
          (a, b) => b.power - a.power || a.cooldownTotal - b.cooldownTotal,
        )[0];
      else if (creature.temperament === 'Steady') {
        selected = [...reachable].sort(
          (a, b) => a.cooldownTotal - b.cooldownTotal || a.power - b.power,
        )[0];
        nextAllowedAt.set(creature.id, input.now + STEADY_BEAT_SECONDS);
      } else if (creature.temperament === 'Skittish') {
        const distanceTiles = Math.hypot(
          creature.tile.x - input.enemy.tile.x,
          creature.tile.y - input.enemy.tile.y,
        );
        const targeted = input.enemy.targetId === creature.id;
        const cornered = shotHolds(distanceTiles, input.enemy.reachTiles);
        const lastStanding = input.creatures.every(
          (other) => other.id === creature.id || other.downed,
        );
        // A targeted creature inside reach plus the release margin still runs instead of picking;
        // otherwise held shots stay unavailable, except when the last one out fights with anything.
        if (targeted && cornered && !lastStanding) continue;
        reachable = reachable.filter(
          (move) =>
            !shotHeld({
              temperament: creature.temperament,
              needsLine: move.needsLine,
              lastStanding,
              distanceTiles,
              enemyReachTiles: input.enemy.reachTiles,
            }),
        );
        if (targeted && cornered && lastStanding) {
          const closeIn = reachable.filter((move) => !move.needsLine);
          if (closeIn.length > 0) reachable = closeIn;
        }
        if (reachable.length === 0) continue;
        selected = [...reachable].sort(
          (a, b) => b.rangeTiles - a.rangeTiles || b.power - a.power,
        )[0];
      } else {
        selected = reachable[Math.floor(rng() * reachable.length)];
        nextAllowedAt.set(
          creature.id,
          input.now +
            ERRATIC_PAUSE_MIN_SECONDS +
            rng() * (ERRATIC_PAUSE_MAX_SECONDS - ERRATIC_PAUSE_MIN_SECONDS),
        );
      }
      if (selected) choices.push({ creatureId: creature.id, moveId: selected.id });
    }
    return choices;
  };
  return {
    choose,
    clear: (creatureId: string): void => void nextAllowedAt.delete(creatureId),
    clearAll: (): void => nextAllowedAt.clear(),
  };
};

export {
  ERRATIC_PAUSE_MAX_SECONDS,
  ERRATIC_PAUSE_MIN_SECONDS,
  STEADY_BEAT_SECONDS,
  choiceInputFrom,
  createChooser,
};
export type { Choice, ChoiceCreature, ChoiceInput, ChoiceMove, Point };
