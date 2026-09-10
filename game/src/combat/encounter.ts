import { speciesById, type HideType, type Temperament } from '../creatures/species.js';
import { yawFromDelta } from '../creatures/facing.js';
import type { Individual } from '../creatures/individual.js';
import { findPath } from '../player/pathing.js';
import type { Move } from './moves.js';
import { hideMultiplier } from './hides.js';
import { arenaSpeedTilesPerSecond } from './pace.js';
import { MIN_SEPARATION_TILES, separate } from './spacing.js';
import {
  canAfford,
  cooldownFor,
  damage,
  deliveries,
  metresToTiles,
  rangeTilesFor,
  windup,
} from './resolve.js';

type Point = { x: number; y: number };
type Positions = Record<string, Point> | Map<string, Point>;
type Combatant = {
  id: string;
  speciesId: string;
  hp: number;
  maxHp: number;
  focus: number;
  maxFocus: number;
  tile: Point;
  facing: number;
  windup: { moveId: string; progress: number } | null;
  downed: boolean;
  cooldowns: Record<string, { remaining: number; total: number }>;
  desiredTile: Point | null;
};
type Projectile = { id: string; moveId: string; owner: string; position: Point; target: Point };
type Flash = { id: string; at: Point; remaining: number };
type CombatState = {
  phase: 'fight' | 'win' | 'driven-off';
  elapsed: number;
  enemy: Omit<Combatant, 'cooldowns' | 'id'>;
  party: Combatant[];
  projectiles: Projectile[];
  flashes: Flash[];
};
type CombatEvent = {
  type: 'hit' | 'miss' | 'executed' | 'downed' | 'win' | 'driven-off';
  attacker?: string;
  target?: string;
  move?: string;
  base?: number;
  hideMult?: number;
  final?: number;
};
type Grid = { isWalkable(tx: number, ty: number): boolean };
type EncounterOptions = {
  party: Individual[];
  enemy: Individual;
  grid: Grid;
  rng: { next(): number } | (() => number);
  player?: Point;
  partyTiles?: Record<string, Point>;
  enemyTile?: Point;
};
type Internal = Combatant & {
  individual: Individual;
  pending: { move: Move; target: Point; targetId: string; elapsed: number; total: number } | null;
  approach: { move: Move; targetId: string; elapsed: number } | null;
  hold: number;
  strafe: number;
  strafeDirection: number;
};
type Flight = Projectile & {
  from: Point;
  to: Point;
  speed: number;
  move: Move;
  targetId: string;
  arc: boolean;
};

const copy = (p: Point): Point => ({ x: p.x, y: p.y });
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const LUNGE_CONTACT_TILES = Math.max(0.5, MIN_SEPARATION_TILES);
const APPROACH_TIMEOUT_SECONDS = 3;
const pointFrom = (positions: Positions, id: string): Point | undefined =>
  positions instanceof Map ? positions.get(id) : positions[id];
const make = (individual: Individual, tile: Point): Internal => ({
  id: individual.id,
  speciesId: individual.speciesId,
  hp: individual.stats.vigor,
  maxHp: individual.stats.vigor,
  focus: individual.stats.focus,
  maxFocus: individual.stats.focus,
  tile: copy(tile),
  facing: 0,
  windup: null,
  downed: false,
  cooldowns: Object.fromEntries(
    individual.repertoire.map((m) => [m.id, { remaining: 0, total: cooldownFor(m) }]),
  ),
  desiredTile: null,
  individual,
  pending: null,
  approach: null,
  hold: 0,
  strafe: 0,
  strafeDirection: 1,
});
const random = (rng: EncounterOptions['rng']): number =>
  typeof rng === 'function' ? rng() : rng.next();

const createEncounter = ({
  party,
  enemy,
  grid,
  rng,
  player = { x: 0, y: 0 },
  partyTiles = {},
  enemyTile = { x: 0, y: -6 },
}: EncounterOptions) => {
  const owned = party.map((p, i) => make(p, partyTiles[p.id] ?? { x: i - 1, y: 1 }));
  const foe = make(enemy, enemyTile);
  let phase: CombatState['phase'] = 'fight',
    elapsed = 0,
    serial = 0,
    partyWipedElapsed: number | null = null;
  const flights: Flight[] = [],
    flashes: Flash[] = [];
  const events: CombatEvent[] = [];
  const all = (): Internal[] => [...owned, foe];
  const byId = (id: string): Internal | undefined => all().find((c) => c.id === id);
  const hide = (c: Internal): HideType => speciesById(c.speciesId)?.hide ?? 'Hide';
  const face = (a: Internal, p: Point): void => {
    a.facing = yawFromDelta(p.x - a.tile.x, p.y - a.tile.y);
  };
  const hit = (attacker: Internal, target: Internal, move: Move): void => {
    if (target.downed) return;
    const base = Math.max(
      1,
      Math.round(move.power * 5 * (0.6 + attacker.individual.stats.power / 10)),
    );
    const final = damage(move, attacker.individual.stats.power, hide(target));
    target.hp = Math.max(0, target.hp - final);
    flashes.push({ id: `${++serial}`, at: copy(target.tile), remaining: 0.16 });
    events.push({
      type: 'hit',
      attacker: attacker.id,
      target: target.id,
      move: move.id,
      base,
      hideMult: hideMultiplier(hide(target), move.force),
      final,
    });
    if (target.hp === 0) {
      target.downed = true;
      target.pending = null;
      target.windup = null;
      events.push({ type: 'downed', target: target.id });
      if (target === foe) {
        phase = 'win';
        flashes.length = 0;
        events.push({ type: 'win' });
      }
    }
    if (target === foe && foe.individual.temperament === 'Skittish') {
      const dx = foe.tile.x - attacker.tile.x,
        dy = foe.tile.y - attacker.tile.y,
        d = Math.hypot(dx, dy) || 1;
      foe.tile.x += (dx / d) * metresToTiles(4);
      foe.tile.y += (dy / d) * metresToTiles(4);
    }
  };
  const launch = (a: Internal, target: Internal, move: Move): void => {
    events.push({ type: 'executed', attacker: a.id, target: target.id, move: move.id });
    if (move.delivery === 'Lunge') {
      hit(a, target, move);
      return;
    }
    if (move.delivery === 'Strike') {
      hit(a, target, move);
      return;
    }
    if (move.delivery === 'Sweep') {
      for (const c of all())
        if (c !== a && !c.downed && distance(a.tile, c.tile) <= rangeTilesFor(move)) {
          const angle = yawFromDelta(c.tile.x - a.tile.x, c.tile.y - a.tile.y),
            delta = Math.atan2(Math.sin(angle - a.facing), Math.cos(angle - a.facing));
          if (Math.abs(delta) <= Math.PI / 3) hit(a, c, move);
        }
      return;
    }
    const to = copy(target.tile),
      d = distance(a.tile, to);
    flights.push({
      id: `${++serial}`,
      from: copy(a.tile),
      to,
      position: copy(a.tile),
      target: to,
      speed: metresToTiles(25),
      moveId: move.id,
      owner: a.id,
      move,
      targetId: target.id,
      arc: move.delivery === 'Arc',
    });
    if (d === 0) flights[flights.length - 1]!.position = copy(to);
  };
  const nearest = (): Internal | undefined =>
    owned
      .filter((c) => !c.downed)
      .sort((a, b) => distance(a.tile, foe.tile) - distance(b.tile, foe.tile))[0];
  const beginMove = (a: Internal, target: Internal, move: Move): void => {
    a.desiredTile = null;
    a.approach = null;
    a.focus -= deliveries[move.delivery].focus;
    a.cooldowns[move.id] = { remaining: cooldownFor(move), total: cooldownFor(move) };
    const total = windup(move, a.individual.stats.speed);
    a.pending = { move, target: copy(target.tile), targetId: target.id, elapsed: 0, total };
    a.windup = { moveId: move.id, progress: 0 };
    face(a, target.tile);
  };
  const useMove = (attackerId: string, moveId: string, targetId?: string): boolean => {
    if (phase !== 'fight') return false;
    const a = byId(attackerId),
      target = targetId ? byId(targetId) : a === foe ? nearest() : foe;
    const move = a?.individual.repertoire.find((m) => m.id === moveId);
    if (
      !a ||
      !target ||
      !move ||
      a.downed ||
      target.downed ||
      a.pending ||
      a.approach ||
      a.cooldowns[move.id]!.remaining > 0 ||
      !canAfford(a.focus, move)
    )
      return false;
    if (distance(a.tile, target.tile) > rangeTilesFor(move)) {
      if (!['Strike', 'Lunge'].includes(move.delivery)) return false;
      const d = distance(a.tile, target.tile),
        // Controllers stop at tile centres, so aim slightly inside the exact range boundary.
        travel = Math.max(0, d - rangeTilesFor(move) + 0.25),
        dx = (target.tile.x - a.tile.x) / (d || 1),
        dy = (target.tile.y - a.tile.y) / (d || 1);
      a.desiredTile =
        move.delivery === 'Lunge'
          ? copy(target.tile)
          : { x: a.tile.x + dx * travel, y: a.tile.y + dy * travel };
      a.approach = { move, targetId: target.id, elapsed: 0 };
      return true;
    }
    beginMove(a, target, move);
    return true;
  };
  const chooseEnemyMove = (): Move | undefined => {
    return enemyMoveCandidates()[0];
  };
  const enemyMoveCandidates = (): Move[] => {
    const target = nearest();
    if (!target) return [];
    const d = distance(foe.tile, target.tile);
    const candidates = foe.individual.repertoire.filter(
      (m) =>
        foe.cooldowns[m.id]!.remaining <= 0 &&
        canAfford(foe.focus, m) &&
        (d <= rangeTilesFor(m) || m.delivery === 'Strike' || m.delivery === 'Lunge'),
    );
    return candidates
      .map((move) => ({ move, score: Math.abs(rangeTilesFor(move) - d), tie: random(rng) }))
      .sort((a, b) => a.score - b.score || a.tie - b.tie)
      .map(({ move }) => move);
  };
  const moveEnemy = (dt: number, target: Point, requiredRange?: number): void => {
    const temperament: Temperament = foe.individual.temperament,
      d = distance(foe.tile, target),
      dx = (target.x - foe.tile.x) / (d || 1),
      dy = (target.y - foe.tile.y) / (d || 1),
      speed = arenaSpeedTilesPerSecond(foe.individual.stats.speed);
    let step = 0;
    if (requiredRange !== undefined && d > requiredRange)
      step = Math.min(speed * dt, d - requiredRange);
    else if (temperament === 'Bold' && d > metresToTiles(3))
      step = Math.min(speed * dt, d - metresToTiles(3));
    if (requiredRange === undefined && temperament === 'Skittish' && d < metresToTiles(10))
      step = -Math.min(speed * dt, metresToTiles(10) - d);
    if (requiredRange === undefined && temperament === 'Steady') {
      if (d < metresToTiles(5)) step = -speed * dt;
      else if (d > metresToTiles(7)) step = speed * dt;
    }
    let strafeStep = 0;
    if (requiredRange === undefined && temperament === 'Erratic') {
      if (foe.strafe <= 0) {
        foe.strafe = 1.5 + random(rng) * 1.5;
        foe.strafeDirection = random(rng) < 0.5 ? -1 : 1;
      }
      foe.strafe -= dt;
      strafeStep = speed * dt * foe.strafeDirection;
    }
    const next = {
      x: foe.tile.x + dx * step - dy * strafeStep,
      y: foe.tile.y + dy * step + dx * strafeStep,
    };
    if (grid.isWalkable(Math.floor(next.x), Math.floor(next.y))) foe.tile = next;
    else {
      const path = findPath(
        grid,
        { tx: Math.floor(foe.tile.x), ty: Math.floor(foe.tile.y) },
        { tx: Math.floor(target.x), ty: Math.floor(target.y) },
        { minTx: 0, maxTx: 999, minTy: 0, maxTy: 999, diagonals: true },
      );
      const waypoint = path?.[0];
      if (waypoint) {
        const toward = { x: waypoint.tx + 0.5, y: waypoint.ty + 0.5 },
          waypointDistance = distance(foe.tile, toward),
          waypointStep = Math.min(speed * dt, waypointDistance);
        foe.tile.x += ((toward.x - foe.tile.x) / (waypointDistance || 1)) * waypointStep;
        foe.tile.y += ((toward.y - foe.tile.y) / (waypointDistance || 1)) * waypointStep;
      }
    }
    face(foe, target);
  };
  const update = (
    dt: number,
    positions: Positions = {},
    playerTile: Point = player,
  ): CombatEvent[] => {
    events.length = 0;
    if (phase !== 'fight') return events;
    elapsed += dt;
    for (const c of all()) {
      const p = pointFrom(positions, c.id);
      if (p && c !== foe && !c.pending) c.tile = copy(p);
    }
    const standing = all().filter((c) => !c.downed),
      separated = separate(
        standing.map((c) => ({
          id: c.id,
          tile: c.tile,
          maxStep: arenaSpeedTilesPerSecond(c.individual.stats.speed) * dt,
        })),
        (tx, ty) => grid.isWalkable(tx, ty),
      );
    for (const c of standing) c.tile = separated[c.id]!;
    for (const c of all()) {
      c.focus = Math.min(c.maxFocus, c.focus + 2 * dt);
      for (const cd of Object.values(c.cooldowns)) cd.remaining = Math.max(0, cd.remaining - dt);
    }
    for (const c of all()) {
      if (!c.approach) continue;
      const target = byId(c.approach.targetId);
      if (!target || target.downed) {
        c.approach = null;
        c.desiredTile = null;
      } else if (
        c.approach.move.delivery === 'Lunge'
          ? distance(c.tile, target.tile) <= LUNGE_CONTACT_TILES
          : distance(c.tile, target.tile) <= rangeTilesFor(c.approach.move) + 0.05
      ) {
        beginMove(c, target, c.approach.move);
      } else {
        c.approach.elapsed += dt;
        if (c.approach.elapsed >= APPROACH_TIMEOUT_SECONDS) {
          c.approach = null;
          c.desiredTile = null;
        }
      }
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const flash = flashes[i]!;
      flash.remaining -= dt;
      if (flash.remaining <= 0) flashes.splice(i, 1);
    }
    for (const c of all())
      if (c.pending) {
        c.pending.elapsed += dt;
        c.windup = {
          moveId: c.pending.move.id,
          progress: Math.min(1, c.pending.elapsed / c.pending.total),
        };
        if (c.pending.elapsed >= c.pending.total) {
          const t = byId(c.pending.targetId);
          const m = c.pending.move;
          c.pending = null;
          c.windup = null;
          if (t && !t.downed) launch(c, t, m);
        }
      }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]!,
        d = distance(f.position, f.to),
        step = Math.min(d, f.speed * dt),
        dx = (f.to.x - f.position.x) / (d || 1),
        dy = (f.to.y - f.position.y) / (d || 1);
      f.position.x += dx * step;
      f.position.y += dy * step;
      if (!grid.isWalkable(Math.floor(f.position.x), Math.floor(f.position.y))) {
        events.push({ type: 'miss', attacker: f.owner, move: f.moveId });
        flights.splice(i, 1);
        continue;
      }
      if (step >= d - 0.0001) {
        const a = byId(f.owner)!;
        if (f.arc) {
          for (const c of all())
            if (c !== a && !c.downed && distance(c.tile, f.to) <= metresToTiles(3))
              hit(a, c, f.move);
        } else {
          const t = byId(f.targetId);
          if (t && !t.downed && distance(t.tile, f.to) <= 0.45) hit(a, t, f.move);
          else events.push({ type: 'miss', attacker: f.owner, move: f.moveId });
        }
        flights.splice(i, 1);
      }
    }
    const target = nearest();
    if (target) partyWipedElapsed = null;
    if (!foe.downed && !foe.pending && target) {
      foe.hold = Math.max(0, foe.hold - dt);
      if (foe.hold <= 0) {
        if (foe.approach) {
          const approachTarget = byId(foe.approach.targetId);
          if (approachTarget && !approachTarget.downed) {
            const requiredRange =
              foe.approach.move.delivery === 'Lunge'
                ? LUNGE_CONTACT_TILES
                : rangeTilesFor(foe.approach.move);
            moveEnemy(dt, approachTarget.tile, requiredRange);
            if (distance(foe.tile, approachTarget.tile) <= requiredRange + 0.05)
              beginMove(foe, approachTarget, foe.approach.move);
          }
        } else {
          moveEnemy(dt, target.tile);
          const used = enemyMoveCandidates().some((move) => useMove(foe.id, move.id, target.id));
          if (!used) foe.hold = 1;
        }
      }
    }
    if (!foe.downed && !target) {
      partyWipedElapsed = (partyWipedElapsed ?? 0) + dt;
      const drivenOffRange = metresToTiles(2);
      if (!foe.pending) moveEnemy(dt, playerTile, drivenOffRange);
      // Movement can settle one floating-point ulp outside the exact range boundary.
      if (distance(foe.tile, playerTile) <= drivenOffRange + 1e-6 || partyWipedElapsed >= 3) {
        phase = 'driven-off';
        flashes.length = 0;
        events.push({ type: 'driven-off' });
      }
    }
    return events.map((e) => ({ ...e }));
  };
  const publicCombatant = (c: Internal): Combatant => ({
    id: c.id,
    speciesId: c.speciesId,
    hp: c.hp,
    maxHp: c.maxHp,
    focus: c.focus,
    maxFocus: c.maxFocus,
    tile: copy(c.tile),
    facing: c.facing,
    windup: c.windup ? { ...c.windup } : null,
    downed: c.downed,
    cooldowns: structuredClone(c.cooldowns),
    desiredTile: c.desiredTile ? copy(c.desiredTile) : null,
  });
  const state = (): CombatState => ({
    phase,
    elapsed,
    enemy: {
      speciesId: foe.speciesId,
      hp: foe.hp,
      maxHp: foe.maxHp,
      focus: foe.focus,
      maxFocus: foe.maxFocus,
      tile: copy(foe.tile),
      facing: foe.facing,
      windup: foe.windup ? { ...foe.windup } : null,
      downed: foe.downed,
      desiredTile: foe.desiredTile ? copy(foe.desiredTile) : null,
    },
    party: owned.map(publicCombatant),
    projectiles: flights.map((p) => ({
      id: p.id,
      moveId: p.moveId,
      owner: p.owner,
      position: copy(p.position),
      target: copy(p.target),
    })),
    flashes: flashes.map((f) => structuredClone(f)),
  });
  const heal = (): void => {
    for (const c of all()) {
      c.hp = c.maxHp;
      c.focus = c.maxFocus;
      c.downed = false;
    }
  };
  return {
    update,
    useMove,
    state,
    heal,
    nearestTarget: () => nearest()?.id ?? null,
    chooseEnemyMove: () => chooseEnemyMove()?.id ?? null,
  };
};

export { createEncounter };
export type { CombatEvent, CombatState, EncounterOptions, Point, Positions };
