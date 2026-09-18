import type { Temperament } from '../creatures/species.js';
import { MIN_SEPARATION_TILES } from './spacing.js';
import { lineClear } from './line.js';

const TAP_OVERRIDE_SECONDS = 4;
// One tile of buffer plus the ground a heavy covers during a Bolt windup.
const KITE_MARGIN_TILES = 2.25;
// The margin is the ground the heavy covers during the kiter's Bolt windup at the heavy's arena
// speed, plus a quarter tile, floored at 1.25 tiles. An Antlerback (speed 4–5) travels at
// (3 + 0.6·speed)/2 × 0.5 = 1.35–1.5 t/s and closes 0.85–0.95 tiles during a speed-7
// kiter's signature Bolt windup: 0.9 × (1.2 − 7×0.06) × (1 − 1×0.1) = 0.63 s.
// Adding 0.25 gives 1.10–1.20, floored to 1.25, so release is at reach + 1.25 (about
// 2.5 tiles for an enemy whose only reach is a 2.5 m Strike; 3.25 tiles for the arena
// Antlerback, whose Rake (Sweep, 4 m) puts its reachTiles at 2.0). An Arc's 1.2 s base
// computes to 1.39–1.51 and is not covered by the floor; if a kiter ever carries an Arc,
// that is a follow-up rather than making this margin per-delivery here.
const SHOT_RELEASE_MARGIN_TILES = 1.25;
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
  moves: readonly {
    rangeTiles: number;
    power: number;
    cooldownTotal: number;
    ready: boolean;
    ranged: boolean;
  }[];
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
const kiteHolds = (distanceTiles: number, enemyReach: number): boolean =>
  distanceTiles <= enemyReach + KITE_MARGIN_TILES;
const shotHolds = (distanceTiles: number, enemyReach: number): boolean =>
  distanceTiles < enemyReach + SHOT_RELEASE_MARGIN_TILES;
const centre = (p: Point): Point => ({ x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5 });
const unit = (from: Point, to: Point, fallback = { x: 0, y: -1 }): Point => {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    d = Math.hypot(dx, dy);
  return d ? { x: dx / d, y: dy / d } : fallback;
};

const bestMoveFor = (temperament: Temperament, moves: FormationCreature['moves']) => {
  const pool = [...moves];
  if (temperament === 'Skittish')
    pool.sort((a, b) => b.rangeTiles - a.rangeTiles || b.power - a.power);
  else if (temperament === 'Steady')
    pool.sort((a, b) => a.cooldownTotal - b.cooldownTotal || a.power - b.power);
  else pool.sort((a, b) => b.power - a.power || b.rangeTiles - a.rangeTiles);
  return pool[0];
};

const ringFor = (
  temperament: Temperament,
  moves: FormationCreature['moves'],
  opposingReach: number,
): number | null => {
  const best = bestMoveFor(temperament, moves);
  if (!best?.ranged) return null;
  // The ring is the kite line, one tile outside the hold-the-shot release line, so a shooter can
  // finish its windup before the heavy arrives. It is 3.5 tiles against the explainer's Strike-only
  // heavy (reachTiles 1.25), and 4.25 against the arena Antlerback (foeReach 2.0 from its 4 m Rake
  // Sweep): the difference is the enemy's reach, not the move's. The move's own reach binds only
  // when shorter, hence Math.min; a ring below the release line cannot support ranged formation.
  const ring = Math.min(best.rangeTiles - 0.5, opposingReach + KITE_MARGIN_TILES);
  return ring < opposingReach + SHOT_RELEASE_MARGIN_TILES ? null : ring;
};

const ringTolerances: Record<Temperament, { outer: number; inner: number }> = {
  Skittish: { outer: 0.3, inner: 0.6 },
  Erratic: { outer: 0.3, inner: 0.6 },
  Steady: { outer: 0.6, inner: 1.2 },
  Bold: { outer: 0.6, inner: 1.2 },
};

const stepAway = (
  creature: FormationCreature,
  enemy: Point,
  maximumDistance: number,
  isWalkable: (tx: number, ty: number) => boolean,
): Point => {
  const currentDistance = distance(creature.tile, enemy);
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
      candidateDistance <= maximumDistance &&
      lineClear(candidate, enemy, isWalkable)
    )
      return candidate;
  }
  return centre(creature.tile);
};

const kiteFrom = (
  creature: FormationCreature,
  enemy: Point,
  enemyReach: number,
  isWalkable: (tx: number, ty: number) => boolean,
): Point | null => {
  const ranged = creature.moves.filter((move) => move.ranged);
  const currentDistance = distance(creature.tile, enemy);
  if (ranged.length === 0 || !kiteHolds(currentDistance, enemyReach)) return null;
  return stepAway(creature, enemy, Math.max(...ranged.map((move) => move.rangeTiles)), isWalkable);
};

const ringTarget = (
  creature: FormationCreature,
  enemy: Point,
  enemyReach: number,
  isWalkable: (tx: number, ty: number) => boolean,
): Point | null => {
  if (creature.temperament === 'Erratic' && (creature.wander?.remaining ?? 0) > 0) return null;
  const ring = ringFor(creature.temperament, creature.moves, enemyReach);
  if (ring === null) return null;
  const currentDistance = distance(creature.tile, enemy);
  const tolerance = ringTolerances[creature.temperament];
  if (currentDistance < ring - tolerance.outer || kiteHolds(currentDistance, enemyReach)) {
    return (
      kiteFrom(creature, enemy, enemyReach, isWalkable) ??
      stepAway(creature, enemy, ring + 0.5, isWalkable)
    );
  }
  if (currentDistance > ring + tolerance.inner && !kiteHolds(currentDistance, enemyReach)) {
    const toward = unit(creature.tile, enemy);
    const candidate = centre({
      x: creature.tile.x + toward.x * KITE_STEP_TILES,
      y: creature.tile.y + toward.y * KITE_STEP_TILES,
    });
    return isWalkable(Math.floor(candidate.x), Math.floor(candidate.y))
      ? candidate
      : centre(creature.tile);
  }
  return centre(creature.tile);
};

const formation = (input: FormationInput): FormationOutput => {
  const u = unit(input.player, input.enemy);
  const steady = { x: input.player.x + u.x * 2.5, y: input.player.y + u.y * 2.5 };
  const desired = input.creatures.map((creature): FormationOutput[number] => {
    let target: Point;
    let wander = creature.wander;
    const ring = ringTarget(creature, input.enemy, input.enemyReach, input.isWalkable);
    if (ring) target = ring;
    else if (creature.temperament === 'Skittish') {
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

export {
  formation,
  kiteFrom,
  kiteHolds,
  KITE_MARGIN_TILES,
  KITE_STEP_TILES,
  bestMoveFor,
  ringFor,
  ringTarget,
  shotHolds,
  SHOT_RELEASE_MARGIN_TILES,
  TAP_OVERRIDE_SECONDS,
};
export type { FormationCreature, FormationInput, FormationOutput, Point, Wander };
