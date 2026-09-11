import type { Temperament } from '../creatures/species.js';
import { MIN_SEPARATION_TILES } from './spacing.js';
import { lineClear } from './line.js';

const TAP_OVERRIDE_SECONDS = 4;
// One tile of buffer plus the ground a heavy covers during a Bolt windup.
const KITE_MARGIN_TILES = 2.25;
const KITE_STEP_TILES = 1;
type Point = { x: number; y: number };
type Wander = { target: Point; remaining: number } | null;
type FormationCreature = {
  id: string;
  temperament: Temperament;
  tile: Point;
  home: Point;
  hp: number;
  maxHp: number;
  moves: readonly { rangeTiles: number; power: number; ready: boolean; ranged: boolean }[];
  wander: Wander;
};
type FormationInput = {
  player: Point;
  enemy: Point;
  enemyReach: number;
  creatures: readonly FormationCreature[];
  isWalkable(tx: number, ty: number): boolean;
  rng(): number;
  dt: number;
};
type FormationOutput = { id: string; tile: Point; wander: Wander }[];

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const centre = (p: Point): Point => ({ x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5 });
const unit = (from: Point, to: Point, fallback = { x: 0, y: -1 }): Point => {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    d = Math.hypot(dx, dy);
  return d ? { x: dx / d, y: dy / d } : fallback;
};

const kiteFrom = (
  creature: FormationCreature,
  enemy: Point,
  enemyReach: number,
  isWalkable: (tx: number, ty: number) => boolean,
): Point | null => {
  const ranged = creature.moves.filter((move) => move.ranged);
  const currentDistance = distance(creature.tile, enemy);
  if (ranged.length === 0 || currentDistance > enemyReach + KITE_MARGIN_TILES) return null;
  const away = unit(enemy, creature.tile);
  for (const angle of [0, Math.PI / 4, -Math.PI / 4]) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const direction = { x: away.x * cos - away.y * sin, y: away.x * sin + away.y * cos };
    const candidate = centre({
      x: creature.tile.x + direction.x * KITE_STEP_TILES,
      y: creature.tile.y + direction.y * KITE_STEP_TILES,
    });
    const candidateDistance = distance(candidate, enemy);
    if (
      isWalkable(Math.floor(candidate.x), Math.floor(candidate.y)) &&
      candidateDistance > currentDistance &&
      candidateDistance <= Math.max(...ranged.map((move) => move.rangeTiles)) &&
      lineClear(candidate, enemy, isWalkable)
    )
      return candidate;
  }
  return centre(creature.tile);
};

const formation = (input: FormationInput): FormationOutput => {
  const u = unit(input.player, input.enemy);
  const steady = { x: input.player.x + u.x * 2.5, y: input.player.y + u.y * 2.5 };
  const desired = input.creatures.map((creature): FormationOutput[number] => {
    let target: Point;
    let wander = creature.wander;
    if (creature.temperament === 'Skittish') {
      const kite = kiteFrom(creature, input.enemy, input.enemyReach, input.isWalkable);
      const holds =
        distance(creature.tile, input.player) <= 2 &&
        distance(creature.tile, input.enemy) >= distance(input.player, input.enemy);
      target =
        kite ??
        (holds ? creature.tile : { x: input.player.x - u.x * 1.5, y: input.player.y - u.y * 1.5 });
    } else if (
      creature.temperament === 'Steady' ||
      (creature.temperament === 'Bold' && creature.hp < creature.maxHp * 0.3) ||
      (creature.temperament === 'Erratic' && distance(input.player, creature.tile) <= 2)
    ) {
      target = distance(creature.tile, steady) <= 0.75 ? creature.tile : steady;
      if (creature.temperament === 'Erratic') wander = null;
    } else if (creature.temperament === 'Bold') {
      const ready = creature.moves.filter((move) => move.ready);
      const best = [...(ready.length ? ready : creature.moves)].sort(
        (a, b) => b.power - a.power,
      )[0];
      const standoff = Math.max(
        (best?.rangeTiles ?? MIN_SEPARATION_TILES + 0.5) - 0.25,
        MIN_SEPARATION_TILES + 0.25,
      );
      const v = unit(creature.tile, input.enemy);
      const anchor = {
        x: input.enemy.x - v.x * standoff,
        y: input.enemy.y - v.y * standoff,
      };
      target = distance(creature.tile, anchor) <= 0.75 ? creature.tile : anchor;
    } else {
      if (wander && wander.remaining > 0 && distance(creature.tile, wander.target) > 0.5) {
        wander = { target: wander.target, remaining: Math.max(0, wander.remaining - input.dt) };
      } else {
        let candidate = centre(creature.home);
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const radius = 1 + input.rng() * 3;
          const angle = input.rng() * Math.PI * 2;
          const rolled = centre({
            x: creature.home.x + Math.cos(angle) * radius,
            y: creature.home.y + Math.sin(angle) * radius,
          });
          if (input.isWalkable(Math.floor(rolled.x), Math.floor(rolled.y))) {
            candidate = rolled;
            break;
          }
        }
        wander = { target: candidate, remaining: 2 + input.rng() * 2 };
      }
      target = wander.target;
    }
    return { id: creature.id, tile: centre(target), wander };
  });

  const occupied = new Set(
    [input.player, input.enemy].map((p) => `${Math.floor(p.x)},${Math.floor(p.y)}`),
  );
  const directions = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ] as const;
  const free = (x: number, y: number) => input.isWalkable(x, y) && !occupied.has(`${x},${y}`);
  return desired.map((output, index) => {
    let tx = Math.floor(output.tile.x),
      ty = Math.floor(output.tile.y);
    if (!free(tx, ty)) {
      let found: Point | undefined;
      for (let radius = 1; radius <= 3 && !found; radius += 1)
        for (const [dx, dy] of directions) {
          const x = tx + dx * radius,
            y = ty + dy * radius;
          if (free(x, y)) {
            found = { x: x + 0.5, y: y + 0.5 };
            break;
          }
        }
      output.tile = found ?? centre(input.creatures[index]!.tile);
      tx = Math.floor(output.tile.x);
      ty = Math.floor(output.tile.y);
    }
    occupied.add(`${tx},${ty}`);
    return output;
  });
};

export { formation, kiteFrom, KITE_MARGIN_TILES, KITE_STEP_TILES, TAP_OVERRIDE_SECONDS };
export type { FormationCreature, FormationInput, FormationOutput, Point, Wander };
