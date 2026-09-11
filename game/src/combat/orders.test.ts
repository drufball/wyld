import { describe, expect, it, vi } from 'vitest';
import { buildArenaIndividual, rosterMember } from '../arena/roster.js';
import type { Individual } from '../creatures/individual.js';
import { createRng } from '../engine/rng.js';
import { createAutopilot } from './autopilot.js';
import { createChooser } from './choice.js';
import { createEncounter, type Point } from './encounter.js';
import type { Move } from './moves.js';
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
const setup = (individual: Individual, enemyTile: Point = { x: 1, y: 0 }) =>
  createEncounter({
    party: [individual],
    enemy: fighter('enemy', [move('enemy-strike', 1)], {
      stats: { vigor: 100_000, power: 1, speed: 1, focus: 0 },
    }),
    grid: { isWalkable: () => true },
    rng: createRng(7),
    partyTiles: { [individual.id]: { x: 0, y: 0 } },
    enemyTile,
    player: { x: 0, y: 0 },
    reserve: '',
  });
const advance = (
  subject: ReturnType<typeof setup>,
  individual: Individual,
  autopilot: ReturnType<typeof createAutopilot>,
  seconds: number,
) => {
  const chooser = createChooser(createRng(7).next);
  const fired = [];
  const events = [];
  for (let tick = 0; tick < seconds * 60; tick += 1) {
    fired.push(
      ...fireOrders({
        combat: subject.state(),
        party: [individual],
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
    const bolt = move('bolt', 4, 'Bolt');
    const individual = fighter('owned', [strike, bolt], { temperament: 'Bold' });
    const subject = setup(individual, { x: 20, y: 0 });
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
        autopilot: { armed: () => null },
        chooser: { choose },
        authorityOf: () => 1,
        useMove,
      }),
    ).toEqual([]);
    expect(choose).not.toHaveBeenCalled();
    expect(useMove).not.toHaveBeenCalled();
  });
});
