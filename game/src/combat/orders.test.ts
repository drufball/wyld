import { describe, expect, it, vi } from 'vitest';
import { buildArenaIndividual, rosterMember } from '../arena/roster.js';
import type { Individual } from '../creatures/individual.js';
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

const move = (id: string, power: number): Move => ({
  id,
  name: id,
  delivery: 'Strike',
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
  it('yields an armed move to the chooser below half authority and resumes above it', () => {
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
