import { describe, expect, it } from 'vitest';
import { buildArenaIndividual, enemy, rosterMember } from '../arena/roster.js';
import type { Individual } from '../creatures/individual.js';
import { createRng } from '../engine/rng.js';
import { createPlayerController } from '../player/controller.js';
import { buildArena } from '../scenarios/scenarios.js';
import { tileToWorld } from '../world/tiles.js';
import { createAutopilot } from './autopilot.js';
import {
  ARENA_BALANCE,
  ARENA_BALANCE_PRESETS,
  scaledEnemyDamage,
  scaledEnemyHealth,
} from './balance.js';
import { createChooser } from './choice.js';
import { createEncounter, type Point } from './encounter.js';
import { fireOrders } from './orders.js';
import { arenaSpeedTilesPerSecond } from './pace.js';
import { damage } from './resolve.js';

const individual = (id: string): Individual => buildArenaIndividual(rosterMember(id)!);

type FightOptions = {
  preset: keyof typeof ARENA_BALANCE_PRESETS;
  party: 'informed' | 'uninformed';
  policy: 'armed' | 'none';
  seed: number;
};

const playFight = ({ preset, party: knowledge, policy, seed }: FightOptions) => {
  const grid = buildArena(11, 22, 'forest');
  const ids =
    knowledge === 'informed'
      ? ['emberjack', 'ashcrawl', 'loamox']
      : ['loamox', 'bramblehog', 'thornwren'];
  const party = ids.map(individual);
  const positions: Record<string, Point> = Object.fromEntries(
    ids.map((id, index) => [id, { x: [5.5, 4.5, 6.5][index]!, y: 12.5 }]),
  );
  const rng = createRng(seed);
  const encounter = createEncounter({
    party,
    enemy: buildArenaIndividual(enemy('antlerback')!),
    grid,
    rng,
    player: { x: 5, y: 11 },
    partyTiles: positions,
    enemyTile: { x: 5.5, y: 5.5 },
    reserve: ids[2],
    balance: ARENA_BALANCE_PRESETS[preset],
  });
  const autopilot = createAutopilot();
  const chooser = createChooser(() => rng.next());
  const controllers = new Map(
    party.map((member) => [
      member.id,
      createPlayerController({
        grid,
        canvas: {} as HTMLCanvasElement,
        cols: () => 11,
        rows: () => 22,
        start: tileToWorld(
          Math.floor(positions[member.id]!.x),
          Math.floor(positions[member.id]!.y),
        ),
        screenFlipping: false,
        diagonals: true,
        speedTilesPerSecond: arenaSpeedTilesPerSecond(member.stats.speed),
      }),
    ]),
  );
  let tapped = false;
  const dt = 1 / 60;

  while (encounter.state().phase === 'fight' && encounter.state().elapsed < 120) {
    const before = encounter.state();
    if (policy === 'armed' && !tapped && before.elapsed >= 1) {
      const moves =
        knowledge === 'informed'
          ? (['emberjack:ember-bolt', 'ashcrawl:ash-spray'] as const)
          : (['loamox:shove', 'bramblehog:quill-jab'] as const);
      autopilot.tap(ids[0]!, moves[0], before.elapsed);
      autopilot.tap(ids[1]!, moves[1], before.elapsed);
      tapped = true;
    }
    fireOrders({
      combat: before,
      party,
      autopilot,
      chooser,
      authorityOf: encounter.authorityOf,
      useMove: encounter.useMove,
    });
    const events = encounter.update(dt, positions, { x: 5, y: 11 });
    for (const event of events) {
      if (event.type === 'downed' && event.target) {
        autopilot.clear(event.target);
        chooser.clear(event.target);
      } else if (event.type === 'auto-deploy' && event.target && event.out) {
        autopilot.clear(event.out);
        chooser.clear(event.out);
        const incoming = encounter.state().party.find(({ id }) => id === event.target)!;
        controllers.get(event.out)?.clearPath();
        const destination = tileToWorld(incoming.tile.x - 0.5, incoming.tile.y - 0.5);
        controllers.get(event.target)?.teleport(destination.x, destination.z);
      }
    }

    for (const member of encounter.state().party)
      if (!member.downed && !member.benched)
        controllers.get(member.id)?.nudge(member.tile.x, member.tile.y);

    for (const member of encounter.state().party) {
      if (member.downed || member.benched || !member.desiredTile) continue;
      const controller = controllers.get(member.id)!;
      if (!controller.moving)
        controller.moveTo({
          tx: Math.floor(member.desiredTile.x),
          ty: Math.floor(member.desiredTile.y),
        });
    }
    for (const [id, controller] of controllers) {
      if (!encounter.state().party.find((member) => member.id === id)?.benched)
        controller.update(dt);
      positions[id] = controller.tile;
    }
  }
  const state = encounter.state();
  return {
    phase: state.phase,
    elapsed: state.elapsed,
    enemyHp: state.enemy.hp,
    enemyMaxHp: state.enemy.maxHp,
  };
};

type FightResult = ReturnType<typeof playFight>;

const runCache = new Map<string, FightResult[]>();
const runs = (options: Omit<FightOptions, 'seed'>): FightResult[] => {
  const key = `${options.preset}/${options.party}/${options.policy}`;
  const cached = runCache.get(key);
  if (cached) return cached;
  const results = [1, 2, 3, 4, 5].map((seed) => playFight({ ...options, seed }));
  runCache.set(key, results);
  return results;
};

describe('arena balance', () => {
  it('trade: the informed Heat party with autopilot wins in 30–60 s in at least 4 of 5 seeded runs', () => {
    const results = runs({ preset: 'trade', party: 'informed', policy: 'armed' });
    expect(
      results.filter((r) => r.phase === 'win' && r.elapsed >= 30 && r.elapsed <= 60).length,
      JSON.stringify(results),
    ).toBeGreaterThanOrEqual(4);
  }, 60_000);
  it('trade: the informed Heat party with zero taps wins in 30–60 s in at least 4 of 5 seeded runs', () => {
    const results = runs({ preset: 'trade', party: 'informed', policy: 'none' });
    expect(
      results.filter((r) => r.phase === 'win' && r.elapsed >= 30 && r.elapsed <= 60).length,
      JSON.stringify(results),
    ).toBeGreaterThanOrEqual(4);
  }, 60_000);
  it('trade: the uninformed party is driven off in 20–40 s in at least 4 of 5 seeded runs', () => {
    const results = runs({ preset: 'trade', party: 'uninformed', policy: 'none' });
    expect(
      results.filter((r) => r.phase === 'driven-off' && r.elapsed >= 20 && r.elapsed <= 40).length,
      JSON.stringify(results),
    ).toBeGreaterThanOrEqual(4);
  }, 60_000);
  it('fast: the informed Heat party wins in under 15 s on every seed', () => {
    for (const policy of ['armed', 'none'] as const) {
      const results = runs({ preset: 'fast', party: 'informed', policy });
      expect(
        results.every((r) => r.phase === 'win' && r.elapsed < 15),
        JSON.stringify({ policy, results }),
      ).toBe(true);
    }
  }, 60_000);
  it('fast: the uninformed party is driven off in under 20 s on every seed', () => {
    const results = runs({ preset: 'fast', party: 'uninformed', policy: 'none' });
    expect(
      results.every((r) => r.phase === 'driven-off' && r.elapsed < 20),
      JSON.stringify(results),
    ).toBe(true);
  }, 60_000);
  it("scales only the arena enemy's health", () => {
    expect(scaledEnemyHealth(200, ARENA_BALANCE_PRESETS.trade)).toBe(650);
    expect(scaledEnemyHealth(200, ARENA_BALANCE_PRESETS.fast)).toBe(200);
    const party = individual('loamox');
    const subject = createEncounter({
      party: [party],
      enemy: buildArenaIndividual(enemy('antlerback')!),
      grid: buildArena(11, 22),
      rng: createRng(1),
    });
    expect(subject.state().enemy.maxHp).toBe(650);
    expect(subject.state().party[0]!.maxHp).toBe(party.stats.vigor);
  }, 60_000);
  it("scales only the arena enemy's damage", () => {
    const foe = buildArenaIndividual(enemy('antlerback')!);
    const strike = foe.repertoire.find((move) => move.delivery === 'Strike')!;
    const raw = damage(strike, foe.stats.power, 'Hide');
    const target = {
      ...individual('loamox'),
      stats: { ...individual('loamox').stats, vigor: 10_000 },
    };
    const subject = createEncounter({
      party: [target],
      enemy: { ...foe, repertoire: [strike] },
      grid: { isWalkable: () => true },
      rng: { next: () => 0 },
      partyTiles: { [target.id]: { x: 0.5, y: 0.5 } },
      enemyTile: { x: 1.5, y: 0.5 },
      reserve: '',
      balance: ARENA_BALANCE_PRESETS.trade,
    });
    let enemyHit: number | undefined;
    for (let ticks = 0; ticks < 300 && enemyHit === undefined; ticks += 1)
      enemyHit = subject
        .update(1 / 60, { [target.id]: { x: 0.5, y: 0.5 } })
        .find((event) => event.type === 'hit' && event.attacker === foe.id)?.final;
    expect(enemyHit).toBe(Math.max(1, Math.round(raw * 0.42)));

    const partyMove = target.repertoire.find((move) => move.delivery === 'Strike')!;
    expect(subject.useMove(target.id, partyMove.id)).toBe(true);
    let partyHit: number | undefined;
    for (let ticks = 0; ticks < 300 && partyHit === undefined; ticks += 1)
      partyHit = subject
        .update(1 / 60, { [target.id]: { x: 0.5, y: 0.5 } })
        .find((event) => event.type === 'hit' && event.attacker === target.id)?.final;
    expect(partyHit).toBe(damage(partyMove, target.stats.power, 'Bark'));
    expect(scaledEnemyDamage(raw, ARENA_BALANCE_PRESETS.trade)).toBe(enemyHit);
  }, 60_000);
  it('the active preset is trade', () => {
    expect(ARENA_BALANCE).toBe(ARENA_BALANCE_PRESETS.trade);
  }, 60_000);
});

export { playFight };
