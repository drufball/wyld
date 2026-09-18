import { describe, expect, it, vi } from 'vitest';
import { buildArenaIndividual, rosterMember } from '../arena/roster.js';
import type { Individual } from '../creatures/individual.js';
import { createRng } from '../engine/rng.js';
import { createAutopilot } from './autopilot.js';
import { createChooser } from './choice.js';
import { createEncounter, type Point } from './encounter.js';
import { SHOT_RELEASE_MARGIN_TILES } from './formation.js';
import type { Move } from './moves.js';
import { arenaSpeedTilesPerSecond } from './pace.js';
import {
  createOrderLog,
  createRefusalFeedback,
  fireOrders,
  ignoredTell,
  type OrderEntry,
} from './orders.js';

const move = (id: string, power: number, delivery: Move['delivery'] = 'Strike'): Move => ({
  id,
  name: id,
  delivery,
  force: 'Impact',
  power,
  speed: 1,
  cooldownMult: 1,
  rangeMult: 1,
  modifiers: [],
  familiarity: 0,
  upgradeLevel: 0,
});
const fighter = (id: string, moves: Move[], overrides: Partial<Individual> = {}): Individual => ({
  ...buildArenaIndividual(rosterMember('loamox')!),
  id,
  repertoire: moves,
  ...overrides,
});
const setup = (
  individual: Individual,
  enemyTile: Point = { x: 1, y: 0 },
  roster: Individual[] = [individual],
) =>
  createEncounter({
    party: roster,
    enemy: fighter('enemy', [move('enemy-strike', 1)], {
      stats: { vigor: 100_000, power: 1, speed: 1, focus: 0 },
    }),
    grid: { isWalkable: () => true },
    rng: createRng(7),
    partyTiles: Object.fromEntries(
      roster.map(({ id }, index) => [id, index === 0 ? { x: 0, y: 0 } : { x: -6, y: -6 }]),
    ),
    enemyTile,
    player: { x: 0, y: 0 },
    ...(roster.length === 1 ? { reserve: '' } : { out: individual.id }),
  });
const advance = (
  subject: ReturnType<typeof setup>,
  individual: Individual,
  autopilot: ReturnType<typeof createAutopilot>,
  seconds: number,
  roster: Individual[] = [individual],
) => {
  const chooser = createChooser(createRng(7).next);
  const fired = [];
  const events = [];
  for (let tick = 0; tick < seconds * 60; tick += 1) {
    fired.push(
      ...fireOrders({
        combat: subject.state(),
        party: roster,
        autopilot,
        chooser,
        authorityOf: () => 1,
        useMove: subject.useMove,
      }),
    );
    events.push(...subject.update(1 / 60));
  }
  return { events, fired };
};

const entry = (heard: boolean, at = 0): OrderEntry => ({
  creatureId: 'fighter',
  kind: 'walk',
  moveId: null,
  distanceTiles: 9,
  authority: 0,
  heard,
  at,
});
describe('orders', () => {
  it('toasts a refused move once per fight and notices the button every time', () => {
    const feedback = createRefusalFeedback();
    const entry: OrderEntry = {
      creatureId: 'c',
      kind: 'move',
      moveId: 'ember',
      distanceTiles: 9,
      authority: 0.15,
      heard: false,
      at: 2,
    };
    expect(feedback.refused(entry, 'Cinder')).toEqual({
      notice: { id: 'ember', text: 'Too far — get closer', refused: true, until: 3.5 },
      toast: "Too far — Cinder didn't hear you; get closer",
    });
    expect(feedback.refused(entry, 'Cinder').toast).toBeNull();
    expect(feedback.refused({ ...entry, kind: 'walk', moveId: null }, 'Cinder')).toEqual({
      notice: null,
      toast: null,
    });
    feedback.reset();
    expect(feedback.refused(entry, 'Cinder').toast).not.toBeNull();
  });

  it('raises the "…" tell only on an order that was not heard', () => {
    expect(ignoredTell(entry(true))).toBeNull();
    expect(ignoredTell(entry(false))).toEqual({ kind: 'ignored', text: '…', targetId: 'fighter' });
  });
  it('keeps the most recent fifty orders, oldest first', () => {
    const log = createOrderLog();
    for (let at = 0; at < 55; at++) log.record(entry(true, at));
    expect(log.list().map((o) => o.at)).toEqual(Array.from({ length: 50 }, (_, i) => i + 5));
  });
  it('fires the armed move first whenever it is ready', () => {
    const strike = move('strike', 2);
    const arc = move('arc', 4, 'Arc');
    const individual = fighter('owned', [strike, arc], { temperament: 'Bold' });
    const subject = setup(individual);
    const autopilot = createAutopilot();
    autopilot.tap(individual.id, arc.id, 0);

    const { fired } = advance(subject, individual, autopilot, 14);
    const arcs = fired.filter(({ moveId }) => moveId === arc.id);
    expect(arcs.length).toBeGreaterThanOrEqual(2);
    expect(arcs.every(({ source }) => source === 'autopilot')).toBe(true);
  });

  it('lets the chooser fire another move while the armed move cools down', () => {
    const strike = move('strike', 2);
    const arc = move('arc', 4, 'Arc');
    const individual = fighter('owned', [strike, arc], { temperament: 'Bold' });
    const subject = setup(individual);
    const autopilot = createAutopilot();
    autopilot.tap(individual.id, arc.id, 0);

    const { fired } = advance(subject, individual, autopilot, 6);
    expect(fired[0]).toMatchObject({ moveId: arc.id, source: 'autopilot' });
    expect(
      fired.filter(({ moveId, source }) => moveId === strike.id && source === 'choice').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('never fires the armed move through the chooser', () => {
    const strike = move('strike', 2);
    const arc = move('arc', 4, 'Arc');
    const individual = fighter('owned', [strike, arc], { temperament: 'Bold' });
    const subject = setup(individual);
    const autopilot = createAutopilot();
    autopilot.tap(individual.id, arc.id, 0);

    const { fired } = advance(subject, individual, autopilot, 20);
    expect(fired.filter(({ moveId }) => moveId === arc.id)).not.toHaveLength(0);
    expect(fired.every(({ moveId, source }) => moveId !== arc.id || source === 'autopilot')).toBe(
      true,
    );
  });

  it('waits for an armed move that is ready but out of range instead of choosing', () => {
    const strike = move('strike', 2);
    const bolt = { ...move('bolt', 4, 'Bolt'), rangeMult: 0.05 };
    const individual = fighter('owned', [strike, bolt], { temperament: 'Bold' });
    const subject = setup(individual);
    const autopilot = createAutopilot();
    autopilot.tap(individual.id, bolt.id, 0);

    const { fired } = advance(subject, individual, autopilot, 1);
    expect(fired.filter(({ source }) => source === 'choice')).toHaveLength(0);
  });

  it('yields the whole creature to its chooser when authority drops', () => {
    const light = move('light', 1);
    const heavy = move('heavy', 5);
    const individual = fighter('owned', [light, heavy], {
      temperament: 'Bold',
      stats: { vigor: 70, power: 1, speed: 4, focus: 40 },
    });
    const subject = createEncounter({
      party: [individual],
      enemy: fighter('enemy', [move('enemy-strike', 1)], {
        stats: { vigor: 70, power: 1, speed: 1, focus: 40 },
      }),
      grid: { isWalkable: () => true },
      rng: { next: () => 0 },
      partyTiles: { owned: { x: 0, y: 0 } },
      enemyTile: { x: 1, y: 0 },
      player: { x: 0, y: 0 },
      reserve: '',
    });
    const autopilot = createAutopilot();
    const chooser = createChooser(() => 0);
    autopilot.tap('owned', light.id, 0);

    const nextFired = (playerTile: Point) => {
      for (let tick = 0; tick < 300; tick += 1) {
        const fired = fireOrders({
          combat: subject.state(),
          party: [individual],
          autopilot,
          chooser,
          authorityOf: subject.authorityOf,
          useMove: subject.useMove,
        });
        subject.update(1 / 60, {}, playerTile);
        if (fired.length > 0) return fired[0];
      }
      return undefined;
    };

    expect(nextFired({ x: 0, y: 0 })).toMatchObject({
      moveId: light.id,
      source: 'autopilot',
    });
    expect(nextFired({ x: 0, y: 7 })).toMatchObject({
      moveId: heavy.id,
      source: 'choice',
    });
    expect(autopilot.armed('owned')).toBe(light.id);
    expect(nextFired({ x: 0, y: 0 })).toMatchObject({
      moveId: light.id,
      source: 'autopilot',
    });
  });

  it("armed creature's dps is at least an unarmed creature's over twenty seconds (seeded)", () => {
    const simulate = (armed: boolean): number => {
      const strike = move('strike', 2);
      const arc = move('arc', 4, 'Arc');
      const individual = fighter('owned', [strike, arc], { temperament: 'Bold' });
      const subject = setup(individual);
      const autopilot = createAutopilot();
      if (armed) autopilot.tap(individual.id, arc.id, 0);
      const chooser = createChooser(createRng(7).next);
      let total = 0;
      for (let tick = 0; tick < 20 * 60; tick += 1) {
        fireOrders({
          combat: subject.state(),
          party: [individual],
          autopilot,
          chooser,
          authorityOf: () => 1,
          useMove: subject.useMove,
        });
        for (const event of subject.update(1 / 60))
          if (event.type === 'hit' && event.attacker === individual.id) total += event.final ?? 0;
      }
      return total;
    };
    const armed = simulate(true);
    const unarmed = simulate(false);
    expect(armed).toBeGreaterThanOrEqual(unarmed);
    expect(armed).toBeGreaterThan(0);
    expect(unarmed).toBeGreaterThan(0);
  });
  it('never fires or chooses outside a fight', () => {
    const choose = vi.fn(() => []),
      useMove = vi.fn(() => true);
    expect(
      fireOrders({
        combat: { phase: 'win' } as never,
        party: [{ id: 'fighter', temperament: 'Bold', repertoire: [] }] as never,
        autopilot: { armed: () => null, fresh: () => false, settle: () => undefined },
        chooser: { choose },
        authorityOf: () => 1,
        useMove,
      }),
    ).toEqual([]);
    expect(choose).not.toHaveBeenCalled();
    expect(useMove).not.toHaveBeenCalled();
  });

  it('fires a hand-tapped Bolt inside the margin at once', () => {
    const bolt = move('bolt', 4, 'Bolt');
    const individual = fighter('kiter', [bolt], { temperament: 'Skittish' });
    const subject = setup(individual, { x: 2, y: 0 });
    const autopilot = createAutopilot();
    autopilot.tap('kiter', 'bolt', 0);

    const { events, fired } = advance(subject, individual, autopilot, 1);
    expect(fired[0]).toEqual({ creatureId: 'kiter', moveId: 'bolt', source: 'autopilot' });
    const executedAt = events.findIndex((event) => event.type === 'executed');
    expect(executedAt).toBeGreaterThanOrEqual(0);
    expect(executedAt).toBeLessThan(60);
  });

  it("fires an armed Bolt for a lone Skittish survivor inside the heavy's reach", () => {
    const bolt = move('bolt', 4, 'Bolt');
    const survivor = fighter('survivor', [bolt], { temperament: 'Skittish' });
    const fallen = fighter('fallen', [move('strike', 1)]);
    const reserve = fighter('reserve', [move('strike', 1)]);
    const roster = [survivor, fallen, reserve];
    const subject = setup(survivor, { x: 2, y: 0 }, roster);
    const autopilot = createAutopilot();
    autopilot.tap(survivor.id, bolt.id, 0);
    autopilot.settle(survivor.id);
    const combat = subject.state();
    combat.party.find(({ id }) => id === fallen.id)!.downed = true;
    combat.party.find(({ id }) => id === reserve.id)!.downed = true;
    const run = () =>
      fireOrders({
        combat,
        party: roster,
        autopilot,
        chooser: { choose: () => [] },
        authorityOf: () => 1,
        useMove: () => true,
      });

    expect(run()).toEqual([{ creatureId: survivor.id, moveId: bolt.id, source: 'autopilot' }]);
    combat.party.find(({ id }) => id === reserve.id)!.downed = false;
    expect(run()).toEqual([]);
  });

  it("holds the autopilot re-fire while a Skittish kiter is inside the heavy's reach and margin", () => {
    const bolt = move('bolt', 4, 'Bolt');
    const individual = fighter('kiter', [bolt], { temperament: 'Skittish' });
    const mate = fighter('mate', [move('strike', 1)]);
    const subject = setup(individual, { x: 2, y: 0 }, [individual, mate]);
    const autopilot = createAutopilot();
    autopilot.tap('kiter', 'bolt', 0);

    const { fired } = advance(subject, individual, autopilot, 8, [individual, mate]);
    expect(fired.filter(({ moveId }) => moveId === 'bolt')).toHaveLength(1);
    expect(
      Math.hypot(subject.state().party[0]!.tile.x - 2, subject.state().party[0]!.tile.y),
    ).toBeLessThan(1.25 + SHOT_RELEASE_MARGIN_TILES);
  });

  it('re-fires an armed Bolt for a Bold creature at the same distance', () => {
    const bolt = move('bolt', 4, 'Bolt');
    const individual = fighter('kiter', [bolt], { temperament: 'Bold' });
    const subject = setup(individual, { x: 2, y: 0 });
    const autopilot = createAutopilot();
    autopilot.tap('kiter', 'bolt', 0);

    const { fired } = advance(subject, individual, autopilot, 8);
    const bolts = fired.filter(({ moveId }) => moveId === 'bolt');
    expect(bolts.length).toBeGreaterThanOrEqual(2);
    expect(bolts.every(({ source }) => source === 'autopilot')).toBe(true);
  });

  it('holds a chosen Bolt inside the margin and fires it at range', () => {
    const simulate = (kiterTile: Point) => {
      const tank = fighter('tank', [move('strike', 2)], { temperament: 'Steady' });
      const kiter = fighter('kiter', [move('bolt', 4, 'Bolt')], {
        temperament: 'Skittish',
      });
      const subject = createEncounter({
        party: [tank, kiter],
        enemy: fighter('enemy', [move('enemy-strike', 1)], {
          stats: { vigor: 100_000, power: 1, speed: 1, focus: 0 },
        }),
        grid: { isWalkable: () => true },
        rng: createRng(7),
        partyTiles: { tank: { x: 1, y: 0 }, kiter: kiterTile },
        enemyTile: { x: 2, y: 0 },
        player: { x: 0, y: 0 },
        reserve: '',
      });
      const autopilot = createAutopilot();
      const chooser = createChooser(createRng(7).next);
      const fired = [];
      for (let tick = 0; tick < 2 * 60; tick += 1) {
        fired.push(
          ...fireOrders({
            combat: subject.state(),
            party: [tank, kiter],
            autopilot,
            chooser,
            authorityOf: () => 1,
            useMove: subject.useMove,
          }),
        );
        subject.update(1 / 60);
      }
      return fired;
    };

    expect(simulate({ x: 0, y: 0 }).some(({ creatureId }) => creatureId === 'kiter')).toBe(false);
    expect(simulate({ x: -3, y: 0 })).toContainEqual({
      creatureId: 'kiter',
      moveId: 'bolt',
      source: 'choice',
    });
  });

  it("keeps a kiting Skittish Bolt-holder on autopilot out of a Bold heavy's reach from fight-start distance", () => {
    const bolt = move('bolt', 4, 'Bolt');
    const kiter = fighter('kiter', [bolt], {
      temperament: 'Skittish',
      stats: { vigor: 45, power: 3, speed: 7, focus: 45 },
    });
    const heavy = fighter('heavy', [move('strike', 5)], {
      temperament: 'Bold',
      stats: { vigor: 200, power: 5, speed: 12, focus: 55 },
    });
    const mate = fighter('mate', [move('strike', 1)]);
    const player = { x: 0.5, y: 1.5 };
    const subject = createEncounter({
      party: [kiter, mate],
      enemy: heavy,
      grid: { isWalkable: () => true },
      rng: createRng(339),
      partyTiles: { kiter: { x: 0.5, y: 3.5 }, mate: { x: -6, y: -6 } },
      enemyTile: { x: 0.5, y: -2.5 },
      player,
      out: 'kiter',
    });
    const autopilot = createAutopilot();
    const chooser = createChooser(createRng(339).next);
    const windupDistances: number[] = [];
    let heavyHitDuringWindup = false;
    autopilot.tap('kiter', 'bolt', 0);
    for (let tick = 0; tick < 15 * 60; tick += 1) {
      const before = subject.state();
      const combatant = before.party[0]!;
      const positions: Record<string, Point> = {};
      if (combatant.desiredTile) {
        const dx = combatant.desiredTile.x - combatant.tile.x;
        const dy = combatant.desiredTile.y - combatant.tile.y;
        const d = Math.hypot(dx, dy);
        const step = Math.min(d, arenaSpeedTilesPerSecond(7) / 60);
        positions.kiter =
          d === 0
            ? combatant.tile
            : { x: combatant.tile.x + (dx / d) * step, y: combatant.tile.y + (dy / d) * step };
      }
      const wasWindingUp = combatant.windup !== null;
      const tickEvents = subject.update(1 / 60, positions, player);
      if (
        wasWindingUp &&
        tickEvents.some((event) => event.type === 'hit' && event.attacker === 'heavy')
      )
        heavyHitDuringWindup = true;
      const current = subject.state();
      const shotDistance = Math.hypot(
        current.party[0]!.tile.x - current.enemy.tile.x,
        current.party[0]!.tile.y - current.enemy.tile.y,
      );
      fireOrders({
        combat: current,
        party: [kiter, mate],
        autopilot,
        chooser,
        authorityOf: () => 1,
        useMove: subject.useMove,
      });
      const started = combatant.windup === null && subject.state().party[0]!.windup !== null;
      if (started) windupDistances.push(shotDistance);
    }
    expect(windupDistances.length).toBeGreaterThanOrEqual(2);
    const releaseDistance = subject.state().enemy.reachTiles + SHOT_RELEASE_MARGIN_TILES;
    expect(windupDistances.every((d) => d >= releaseDistance)).toBe(true);
    expect(heavyHitDuringWindup).toBe(false);
  }, 5_000);
});
