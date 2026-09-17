import { speciesById, type HideType, type Temperament } from '../creatures/species.js';
import { yawFromDelta } from '../creatures/facing.js';
import type { Individual } from '../creatures/individual.js';
import { findPath } from '../player/pathing.js';
import type { Move } from './moves.js';
import { hideMultiplier } from './hides.js';
import { arenaSpeedTilesPerSecond } from './pace.js';
import { MIN_SEPARATION_TILES, separate } from './spacing.js';
import { formation, TAP_OVERRIDE_SECONDS, type Wander } from './formation.js';
import { authority, hears, moveTapAuthority } from './authority.js';
import { pickTarget, pruneHits, threatOf, type ThreatHit } from './threat.js';
import { lineClear, nearSideOf } from './line.js';
import {
  ARENA_BALANCE,
  scaledEnemyDamage,
  scaledEnemyHealth,
  type ArenaBalance,
} from './balance.js';
import { ENTRY_GRACE_SECONDS, RESERVE_AUTO_DEPLOY_SECONDS, entryTile } from './reserve.js';
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
  benched: boolean;
  cooldowns: Record<string, { remaining: number; total: number }>;
  desiredTile: Point | null;
  threat: number;
  lineToEnemy: boolean;
  blockedAt: Point | null;
  approaching?: boolean;
  overrideRemaining?: number;
  grace: number;
};
type Projectile = { id: string; moveId: string; owner: string; position: Point; target: Point };
type Flash = { id: string; at: Point; remaining: number };
type CombatState = {
  phase: 'fight' | 'win' | 'driven-off';
  elapsed: number;
  enemy: Omit<
    Combatant,
    'cooldowns' | 'id' | 'benched' | 'overrideRemaining' | 'threat' | 'lineToEnemy'
  > & {
    targetId?: string | null;
    reachTiles: number;
  };
  party: Combatant[];
  reserveId: string | null;
  swapCooldown: { remaining: number; total: number };
  autoDeployIn: number | null;
  projectiles: Projectile[];
  flashes: Flash[];
};
type CombatEvent = {
  type: 'hit' | 'miss' | 'executed' | 'blocked' | 'downed' | 'win' | 'driven-off' | 'auto-deploy';
  attacker?: string;
  target?: string;
  out?: string;
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
  out?: string;
  reserve?: string;
  balance?: ArenaBalance;
};
type Internal = Omit<Combatant, 'lineToEnemy' | 'blockedAt'> & {
  individual: Individual;
  pending: { move: Move; target: Point; targetId: string; elapsed: number; total: number } | null;
  approach: { move: Move; targetId: string; elapsed: number; blockedAt: Point | null } | null;
  hold: number;
  strafe: number;
  strafeDirection: number;
  home: Point;
  wander: Wander;
  overrideUntil: number;
};
type Flight = Projectile & {
  from: Point;
  to: Point;
  speed: number;
  move: Move;
  targetId: string;
  arc: boolean;
};

const shouldAskForReserve = (state: CombatState, alreadyAsked: boolean): boolean => {
  if (alreadyAsked || state.phase !== 'fight' || !state.reserveId) return false;
  const reserve = state.party.find(({ id }) => id === state.reserveId);
  return Boolean(
    reserve &&
    !reserve.downed &&
    reserve.benched &&
    state.party.filter(({ benched }) => !benched).every(({ downed }) => downed),
  );
};

const copy = (p: Point): Point => ({ x: p.x, y: p.y });
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const LUNGE_CONTACT_TILES = Math.max(0.5, MIN_SEPARATION_TILES);
const APPROACH_TIMEOUT_SECONDS = 3;
const pointFrom = (positions: Positions, id: string): Point | undefined =>
  positions instanceof Map ? positions.get(id) : positions[id];
const make = (individual: Individual, tile: Point, benched = false): Internal => ({
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
  benched,
  cooldowns: Object.fromEntries(
    individual.repertoire.map((m) => [m.id, { remaining: 0, total: cooldownFor(m) }]),
  ),
  desiredTile: null,
  threat: 0,
  overrideRemaining: 0,
  grace: 0,
  individual,
  pending: null,
  approach: null,
  hold: 0,
  strafe: 0,
  strafeDirection: 1,
  home: copy(tile),
  wander: null,
  overrideUntil: 0,
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
  out = party[0]?.id,
  reserve,
  balance = ARENA_BALANCE,
}: EncounterOptions) => {
  const outId = out === reserve ? party.find((member) => member.id !== reserve)?.id : out;
  const owned = party.map((p, i) =>
    make(
      p,
      partyTiles[p.id] ?? { x: i - 1, y: 1 },
      reserve === '' ? false : p.id !== outId || p.id === reserve,
    ),
  );
  const foe = make(enemy, enemyTile);
  foe.hp = foe.maxHp = scaledEnemyHealth(enemy.stats.vigor, balance);
  const foeReach = Math.max(
    0,
    ...enemy.repertoire
      .filter((move) => move.delivery === 'Strike' || move.delivery === 'Sweep')
      .map(rangeTilesFor),
  );
  let playerTile = player;
  let phase: CombatState['phase'] = 'fight',
    elapsed = 0,
    serial = 0,
    partyWipedElapsed: number | null = null,
    swapCooldownRemaining = 0,
    autoDeployRemaining: number | null = null;
  const swapCooldownTotal = 6;
  const flights: Flight[] = [],
    flashes: Flash[] = [];
  const events: CombatEvent[] = [];
  const threatHits: ThreatHit[] = [];
  const all = (): Internal[] => [...owned, foe];
  const byId = (id: string): Internal | undefined => all().find((c) => c.id === id);
  const hide = (c: Internal): HideType => speciesById(c.speciesId)?.hide ?? 'Hide';
  const face = (a: Internal, p: Point): void => {
    a.facing = yawFromDelta(p.x - a.tile.x, p.y - a.tile.y);
  };
  const hit = (attacker: Internal, target: Internal, move: Move): void => {
    if (target.downed || target.benched || target.grace > 0) return;
    const base = Math.max(
      1,
      Math.round(move.power * 5 * (0.6 + attacker.individual.stats.power / 10)),
    );
    const dealt = damage(move, attacker.individual.stats.power, hide(target));
    const final = attacker === foe ? scaledEnemyDamage(dealt, balance) : dealt;
    target.hp = Math.max(0, target.hp - final);
    if (target === foe && owned.includes(attacker))
      threatHits.push({ attacker: attacker.id, final, force: move.force, at: elapsed });
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
    if (move.delivery === 'Lunge') {
      const blockedAt = nearSideOf(a.tile, target.tile, (tx, ty) => grid.isWalkable(tx, ty));
      if (blockedAt) {
        a.desiredTile = copy(blockedAt);
        a.approach = { move, targetId: target.id, elapsed: 0, blockedAt: copy(blockedAt) };
        return;
      }
      events.push({ type: 'executed', attacker: a.id, target: target.id, move: move.id });
      hit(a, target, move);
      return;
    }
    events.push({ type: 'executed', attacker: a.id, target: target.id, move: move.id });
    if (move.delivery === 'Strike') {
      hit(a, target, move);
      return;
    }
    if (move.delivery === 'Sweep') {
      for (const c of all())
        if (c !== a && !c.downed && !c.benched && distance(a.tile, c.tile) <= rangeTilesFor(move)) {
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
      .filter((c) => !c.downed && !c.benched && c.grace <= 0)
      .sort((a, b) => distance(a.tile, foe.tile) - distance(b.tile, foe.tile))[0];
  const reachable = (candidate: Internal): boolean =>
    grid.isWalkable(Math.floor(candidate.tile.x), Math.floor(candidate.tile.y)) &&
    (() => {
      const from = { tx: Math.floor(foe.tile.x), ty: Math.floor(foe.tile.y) },
        to = { tx: Math.floor(candidate.tile.x), ty: Math.floor(candidate.tile.y) };
      return (
        findPath(grid, from, to, {
          minTx: Math.min(from.tx, to.tx) - 16,
          maxTx: Math.max(from.tx, to.tx) + 16,
          minTy: Math.min(from.ty, to.ty) - 16,
          maxTy: Math.max(from.ty, to.ty) + 16,
          diagonals: true,
        }) !== null
      );
    })();
  const threatTarget = (): Internal | undefined => {
    const standingOwned = owned.filter((c) => !c.downed && !c.benched && c.grace <= 0);
    const id = pickTarget(
      standingOwned.map((c) => ({ id: c.id, distance: distance(c.tile, foe.tile) })),
      threatHits,
      elapsed,
      (candidateId) => reachable(byId(candidateId)!),
    );
    return id ? byId(id) : undefined;
  };
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
      target = targetId ? byId(targetId) : a === foe ? threatTarget() : foe;
    const move = a?.individual.repertoire.find((m) => m.id === moveId);
    if (
      !a ||
      !target ||
      !move ||
      a.downed ||
      a.benched ||
      target.downed ||
      target.benched ||
      a.pending ||
      a.approach ||
      a.cooldowns[move.id]!.remaining > 0 ||
      !canAfford(a.focus, move)
    )
      return false;
    if (distance(a.tile, target.tile) > rangeTilesFor(move)) {
      if (!['Strike', 'Lunge'].includes(move.delivery)) return false;
      const blockedAt =
        move.delivery === 'Lunge'
          ? nearSideOf(a.tile, target.tile, (tx, ty) => grid.isWalkable(tx, ty))
          : null;
      if (blockedAt) {
        a.focus -= deliveries.Lunge.focus;
        a.cooldowns[move.id] = { remaining: cooldownFor(move), total: cooldownFor(move) };
        a.desiredTile = copy(blockedAt);
        a.approach = { move, targetId: target.id, elapsed: 0, blockedAt: copy(blockedAt) };
        face(a, target.tile);
        return true;
      }
      const d = distance(a.tile, target.tile),
        // Controllers stop at tile centres, so aim slightly inside the exact range boundary.
        travel = Math.max(0, d - rangeTilesFor(move) + 0.25),
        dx = (target.tile.x - a.tile.x) / (d || 1),
        dy = (target.tile.y - a.tile.y) / (d || 1);
      a.desiredTile =
        move.delivery === 'Lunge'
          ? copy(target.tile)
          : { x: a.tile.x + dx * travel, y: a.tile.y + dy * travel };
      a.approach = { move, targetId: target.id, elapsed: 0, blockedAt: null };
      return true;
    }
    if (
      (move.delivery === 'Bolt' || move.delivery === 'Arc') &&
      !lineClear(a.tile, target.tile, (tx, ty) => grid.isWalkable(tx, ty))
    )
      return false;
    beginMove(a, target, move);
    return true;
  };
  const chooseEnemyMove = (): Move | undefined => {
    return enemyMoveCandidates()[0];
  };
  const enemyMoveCandidates = (cachedTarget?: Internal): Move[] => {
    const enemyTarget = cachedTarget ?? threatTarget();
    if (!enemyTarget) return [];
    const d = distance(foe.tile, enemyTarget.tile);
    const candidates = foe.individual.repertoire.filter(
      (m) =>
        foe.cooldowns[m.id]!.remaining <= 0 &&
        canAfford(foe.focus, m) &&
        (d <= rangeTilesFor(m) || m.delivery === 'Strike' || m.delivery === 'Lunge') &&
        (!(m.delivery === 'Bolt' || m.delivery === 'Arc') ||
          lineClear(foe.tile, enemyTarget.tile, (tx, ty) => grid.isWalkable(tx, ty))),
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
        {
          minTx: 0,
          maxTx: 999,
          minTy: 0,
          maxTy: 999,
          diagonals: true,
        },
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
    latestPlayerTile: Point = player,
  ): CombatEvent[] => {
    events.length = 0;
    playerTile = latestPlayerTile;
    if (phase !== 'fight') return events;
    elapsed += dt;
    threatHits.splice(0, threatHits.length, ...pruneHits(threatHits, elapsed));
    swapCooldownRemaining = Math.max(0, swapCooldownRemaining - dt);
    for (const c of owned) c.grace = Math.max(0, c.grace - dt);
    const downed = owned.find((c) => !c.benched && c.downed);
    const reserveCreature = owned.find((c) => c.benched && !c.downed);
    if (downed && reserveCreature) {
      autoDeployRemaining = (autoDeployRemaining ?? RESERVE_AUTO_DEPLOY_SECONDS) - dt;
      if (autoDeployRemaining <= 0) {
        const incomingId = reserveCreature.id;
        if (swap(downed.id))
          events.push({ type: 'auto-deploy', target: incomingId, out: downed.id });
      }
    } else autoDeployRemaining = null;
    for (const c of all()) {
      const p = pointFrom(positions, c.id);
      if (p && c !== foe && !c.benched && !c.pending) c.tile = copy(p);
    }
    const standing = all().filter((c) => !c.downed && !c.benched),
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
      // A reserve catches its breath: focus and cooldowns keep ticking while its HP is untouched.
      c.focus = Math.min(c.maxFocus, c.focus + 2 * dt);
      for (const cd of Object.values(c.cooldowns)) cd.remaining = Math.max(0, cd.remaining - dt);
    }
    for (const c of all()) {
      if (!c.approach || c.benched) continue;
      c.approach.elapsed += dt;
      const target = byId(c.approach.targetId);
      const blockedFinished =
        c.approach.blockedAt !== null &&
        (distance(c.tile, c.approach.blockedAt) <= 0.3 ||
          c.approach.elapsed >= APPROACH_TIMEOUT_SECONDS);
      if (c.approach.blockedAt && (!target || target.downed || target.benched || blockedFinished)) {
        events.push({
          type: 'blocked',
          attacker: c.id,
          target: c.approach.targetId,
          move: c.approach.move.id,
        });
        c.approach = null;
        c.desiredTile = null;
      } else if (!target || target.downed || target.benched) {
        c.approach = null;
        c.desiredTile = null;
      } else if (
        c.approach.move.delivery === 'Lunge'
          ? distance(c.tile, target.tile) <= LUNGE_CONTACT_TILES
          : distance(c.tile, target.tile) <= rangeTilesFor(c.approach.move) + 0.05
      ) {
        beginMove(c, target, c.approach.move);
      } else {
        if (c.approach.elapsed >= APPROACH_TIMEOUT_SECONDS) {
          c.approach = null;
          c.desiredTile = null;
        }
      }
    }
    const formationMembers = owned.filter(
      (c) => !c.downed && !c.benched && !c.approach && !c.pending && elapsed >= c.overrideUntil,
    );
    for (const c of owned)
      if (!c.downed && !c.benched && !c.approach && !c.pending && elapsed < c.overrideUntil)
        c.desiredTile = null;
    const formed = formation({
      player: playerTile,
      enemy: foe.tile,
      enemyReach: foeReach,
      creatures: formationMembers.map((c) => ({
        id: c.id,
        temperament: c.individual.temperament,
        tile: c.tile,
        home: c.home,
        hp: c.hp,
        maxHp: c.maxHp,
        moves: c.individual.repertoire.map((move) => ({
          rangeTiles: rangeTilesFor(move),
          power: move.power,
          ready: c.cooldowns[move.id]!.remaining <= 0 && canAfford(c.focus, move),
          ranged: move.delivery === 'Bolt' || move.delivery === 'Arc',
        })),
        wander: c.wander,
      })),
      isWalkable: (tx, ty) => grid.isWalkable(tx, ty),
      rng: () => random(rng),
      dt,
    });
    for (const result of formed) {
      const c = byId(result.id)!;
      c.wander = result.wander;
      c.desiredTile =
        Math.floor(result.tile.x) === Math.floor(c.tile.x) &&
        Math.floor(result.tile.y) === Math.floor(c.tile.y)
          ? null
          : result.tile;
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const flash = flashes[i]!;
      flash.remaining -= dt;
      if (flash.remaining <= 0) flashes.splice(i, 1);
    }
    for (const c of all())
      if (c.pending && !c.benched) {
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
          if (t && !t.downed && !t.benched) launch(c, t, m);
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
            if (c !== a && !c.downed && !c.benched && distance(c.tile, f.to) <= metresToTiles(3))
              hit(a, c, f.move);
        } else {
          const t = byId(f.targetId);
          if (t && !t.downed && !t.benched && distance(t.tile, f.to) <= 0.45) hit(a, t, f.move);
          else events.push({ type: 'miss', attacker: f.owner, move: f.moveId });
        }
        flights.splice(i, 1);
      }
    }
    const enemyTarget = threatTarget();
    if (enemyTarget) partyWipedElapsed = null;
    if (!foe.downed && !foe.pending && enemyTarget) {
      foe.hold = Math.max(0, foe.hold - dt);
      if (foe.hold <= 0) {
        if (foe.approach) {
          const approachTarget = byId(foe.approach.targetId);
          if (approachTarget && !approachTarget.downed) {
            if (foe.approach.blockedAt) {
              moveEnemy(dt, foe.approach.blockedAt, 0);
            } else {
              const requiredRange =
                foe.approach.move.delivery === 'Lunge'
                  ? LUNGE_CONTACT_TILES
                  : rangeTilesFor(foe.approach.move);
              moveEnemy(dt, approachTarget.tile, requiredRange);
              if (distance(foe.tile, approachTarget.tile) <= requiredRange + 0.05)
                beginMove(foe, approachTarget, foe.approach.move);
            }
          }
        } else {
          moveEnemy(dt, enemyTarget.tile);
          const used = enemyMoveCandidates(enemyTarget).some((move) =>
            useMove(foe.id, move.id, enemyTarget.id),
          );
          if (!used) foe.hold = 1;
        }
      }
    }
    const allOwnedDown = owned.every((c) => c.downed);
    if (!foe.downed && !enemyTarget && allOwnedDown) {
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
  const swap = (outId: string, incomingId?: string): boolean => {
    const outgoing = owned.find((c) => c.id === outId && !c.benched),
      incoming = owned.find(
        (c) => c.benched && !c.downed && (incomingId === undefined || c.id === incomingId),
      );
    if (
      phase !== 'fight' ||
      !outgoing ||
      !incoming ||
      (swapCooldownRemaining > 0 && !outgoing.downed)
    )
      return false;
    incoming.tile = entryTile({
      fallen: outgoing.tile,
      enemy: foe.tile,
      isWalkable: (tx, ty) => grid.isWalkable(tx, ty),
      occupied: [
        foe.tile,
        ...owned
          .filter((c) => c !== outgoing && c !== incoming && !c.downed && !c.benched)
          .map((c) => c.tile),
      ],
    });
    incoming.home = copy(incoming.tile);
    incoming.grace = ENTRY_GRACE_SECONDS;
    incoming.wander = null;
    outgoing.benched = true;
    incoming.benched = false;
    for (const combatant of [outgoing, incoming]) {
      combatant.pending = null;
      combatant.windup = null;
      combatant.approach = null;
      combatant.desiredTile = null;
    }
    if (foe.pending?.targetId === outgoing.id) {
      foe.pending = null;
      foe.windup = null;
    }
    if (foe.approach?.targetId === outgoing.id) {
      foe.approach = null;
      foe.desiredTile = null;
    }
    swapCooldownRemaining = swapCooldownTotal;
    partyWipedElapsed = null;
    autoDeployRemaining = null;
    return true;
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
    benched: c.benched,
    cooldowns: structuredClone(c.cooldowns),
    desiredTile: c.desiredTile ? copy(c.desiredTile) : null,
    threat: threatOf(threatHits, c.id, elapsed),
    approaching: c.approach !== null,
    overrideRemaining: Math.max(0, c.overrideUntil - elapsed),
    lineToEnemy:
      c.benched || c.downed
        ? true
        : lineClear(c.tile, foe.tile, (tx, ty) => grid.isWalkable(tx, ty)),
    blockedAt: c.approach?.blockedAt ? copy(c.approach.blockedAt) : null,
    grace: c.grace,
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
      approaching: foe.approach !== null,
      blockedAt: foe.approach?.blockedAt ? copy(foe.approach.blockedAt) : null,
      targetId: foe.pending?.targetId ?? foe.approach?.targetId ?? threatTarget()?.id ?? null,
      reachTiles: foeReach,
      grace: foe.grace,
    },
    party: owned.map(publicCombatant),
    reserveId: owned.find((c) => c.benched && !c.downed)?.id ?? null,
    swapCooldown: { remaining: swapCooldownRemaining, total: swapCooldownTotal },
    autoDeployIn: autoDeployRemaining === null ? null : Math.max(0, autoDeployRemaining),
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
  const override = (creatureId: string): void => {
    if (phase !== 'fight') return;
    const creature = owned.find(
      (candidate) => candidate.id === creatureId && !candidate.downed && !candidate.benched,
    );
    if (!creature || creature.pending || creature.approach) return;
    creature.overrideUntil = elapsed + TAP_OVERRIDE_SECONDS;
    creature.desiredTile = null;
  };
  const authorityOf = (creatureId: string): number => {
    if (phase !== 'fight') return 1;
    const creature = owned.find(({ id }) => id === creatureId);
    return creature
      ? authority(distance(playerTile, creature.tile), creature.individual.temperament)
      : 0;
  };
  const hear = (creatureId: string, kind: 'walk' | 'move' = 'walk') => {
    if (phase !== 'fight') return { heard: true, authority: 1, distanceTiles: 0 };
    const creature = owned.find(({ id }) => id === creatureId);
    const distanceTiles = creature ? distance(playerTile, creature.tile) : 0;
    const authorityValue =
      kind === 'move' ? moveTapAuthority(authorityOf(creatureId)) : authorityOf(creatureId);
    return { heard: hears(authorityValue, random(rng)), authority: authorityValue, distanceTiles };
  };
  return {
    update,
    useMove,
    swap,
    state,
    heal,
    override,
    authorityOf,
    hear,
    nearestTarget: () => nearest()?.id ?? null,
    chooseEnemyMove: () => chooseEnemyMove()?.id ?? null,
  };
};

export { createEncounter, shouldAskForReserve };
export type { CombatEvent, CombatState, EncounterOptions, Point, Positions };
