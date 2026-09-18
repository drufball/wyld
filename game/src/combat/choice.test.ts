import { describe, expect, it } from 'vitest';
import {
  ERRATIC_PAUSE_MAX_SECONDS,
  ERRATIC_PAUSE_MIN_SECONDS,
  createChooser,
  type ChoiceCreature,
  type ChoiceInput,
  type ChoiceMove,
} from './choice.js';

const move = (id: string, overrides: Partial<ChoiceMove> = {}): ChoiceMove => ({
  id,
  power: 1,
  rangeTiles: 3,
  cooldownTotal: 2,
  cooldownRemaining: 0,
  affordable: true,
  needsLine: false,
  ...overrides,
});
const creature = (overrides: Partial<ChoiceCreature> = {}): ChoiceCreature => ({
  id: 'owned',
  temperament: 'Bold',
  tile: { x: 0, y: 0 },
  downed: false,
  benched: false,
  busy: false,
  armed: false,
  lineToEnemy: true,
  moves: [move('light'), move('heavy', { power: 3 })],
  ...overrides,
});
const input = (owned = creature(), now = 0): ChoiceInput => ({
  now,
  enemy: { tile: { x: 2, y: 0 }, targetId: null, downed: false, reachTiles: 2 },
  creatures: [owned],
});

describe('temperament move choice', () => {
  it('chooses the heaviest reachable move for a Bold creature', () => {
    const chooser = createChooser(() => 0);
    const owned = creature({
      moves: [
        move('light'),
        move('heavy', { power: 5, rangeTiles: 1 }),
        move('cooling', { power: 7, cooldownRemaining: 1 }),
      ],
    });
    expect(chooser.choose(input(owned))).toEqual([{ creatureId: 'owned', moveId: 'light' }]);
    expect(chooser.choose(input(owned, 0.01))).toEqual([{ creatureId: 'owned', moveId: 'light' }]);
  });

  it('chooses the cheapest cooldown for a Steady creature on a one second beat', () => {
    const chooser = createChooser(() => 0);
    const owned = creature({
      temperament: 'Steady',
      moves: [move('slow', { cooldownTotal: 4 }), move('quick', { cooldownTotal: 2 })],
    });
    expect(chooser.choose(input(owned))).toEqual([{ creatureId: 'owned', moveId: 'quick' }]);
    expect(chooser.choose(input(owned, 0.5))).toEqual([]);
    expect(chooser.choose(input(owned, 1))).toHaveLength(1);
  });

  it('lets a Skittish creature strike only while the enemy targets someone else', () => {
    const chooser = createChooser(() => 0);
    const owned = creature({
      temperament: 'Skittish',
      moves: [move('near'), move('far', { rangeTiles: 5 })],
    });
    const focused = input(owned);
    focused.creatures = [owned, creature({ id: 'reserve', benched: true })];
    focused.enemy.targetId = owned.id;
    expect(chooser.choose(focused)).toEqual([]);
    focused.enemy.targetId = 'other';
    expect(chooser.choose(focused)).toEqual([{ creatureId: 'owned', moveId: 'far' }]);
    focused.enemy.targetId = null;
    expect(chooser.choose(focused)).toHaveLength(1);
  });

  it('lets a targeted Skittish creature on its ring pick its Bolt', () => {
    const owned = creature({
      temperament: 'Skittish',
      tile: { x: 4.5, y: 0 },
      moves: [move('Bolt', { rangeTiles: 10, needsLine: true })],
    });
    const focused = input(owned);
    focused.enemy.tile.x = 0;
    focused.enemy.targetId = owned.id;
    expect(createChooser(() => 0).choose(focused)).toEqual([
      { creatureId: 'owned', moveId: 'Bolt' },
    ]);
  });

  it('lets the last Skittish creature standing fight while cornered', () => {
    const owned = creature({ temperament: 'Skittish', tile: { x: 1.5, y: 0 } });
    const focused = input(owned);
    focused.enemy.tile.x = 0;
    focused.enemy.targetId = owned.id;
    focused.creatures = [owned, creature({ id: 'fallen', downed: true })];
    expect(createChooser(() => 0).choose(focused)).toHaveLength(1);
  });

  it('gives a cornered last survivor a move it can throw', () => {
    const owned = creature({
      temperament: 'Skittish',
      tile: { x: 1.5, y: 0 },
      moves: [move('Bolt', { rangeTiles: 10, needsLine: true }), move('Lunge', { rangeTiles: 4 })],
    });
    const focused = input(owned);
    focused.enemy.tile.x = 0;
    focused.enemy.targetId = owned.id;
    focused.creatures = [owned, creature({ id: 'fallen', downed: true })];
    expect(createChooser(() => 0).choose(focused)).toEqual([
      { creatureId: 'owned', moveId: 'Lunge' },
    ]);
  });

  it('still suppresses a targeted Skittish creature while a reserve is alive', () => {
    const owned = creature({ temperament: 'Skittish', tile: { x: 1.5, y: 0 } });
    const focused = input(owned);
    focused.enemy.tile.x = 0;
    focused.enemy.targetId = owned.id;
    focused.creatures = [owned, creature({ id: 'reserve', benched: true })];
    expect(createChooser(() => 0).choose(focused)).toEqual([]);
  });

  it("picks an Erratic creature's move at random and pauses between choices", () => {
    let seed = 7;
    const chooser = createChooser(
      () => (seed = (seed * 1_664_525 + 1_013_904_223) >>> 0) / 2 ** 32,
    );
    const owned = creature({ temperament: 'Erratic', moves: [move('a'), move('b'), move('c')] });
    const picked = new Set<string>();
    let now = 0;
    for (let count = 0; count < 8; count += 1) {
      const choice = chooser.choose(input(owned, now));
      expect(choice).toHaveLength(1);
      picked.add(choice[0]!.moveId);
      expect(chooser.choose(input(owned, now + ERRATIC_PAUSE_MIN_SECONDS - 0.01))).toEqual([]);
      now += ERRATIC_PAUSE_MAX_SECONDS;
    }
    expect(picked.size).toBeGreaterThanOrEqual(2);
  });

  it('never chooses for a creature with an armed autopilot', () => {
    expect(createChooser(() => 0).choose(input(creature({ armed: true })))).toEqual([]);
  });

  it('never chooses for a downed or benched creature', () => {
    const chooser = createChooser(() => 0);
    expect(chooser.choose(input(creature({ downed: true })))).toEqual([]);
    expect(chooser.choose(input(creature({ benched: true })))).toEqual([]);
  });

  it('never chooses while a move is winding up or approaching', () => {
    expect(createChooser(() => 0).choose(input(creature({ busy: true })))).toEqual([]);
  });

  it('never chooses a move that is on cooldown or unaffordable', () => {
    const owned = creature({
      moves: [move('cooling', { cooldownRemaining: 0.1 }), move('costly', { affordable: false })],
    });
    expect(createChooser(() => 0).choose(input(owned))).toEqual([]);
  });

  it('waits for range instead of starting an approach', () => {
    const chooser = createChooser(() => 0);
    const owned = creature({ moves: [move('strike', { rangeTiles: 1.25 })] });
    const far = input(owned);
    far.enemy.tile.x = 6;
    expect(chooser.choose(far)).toEqual([]);
    far.enemy.tile.x = 1.2;
    expect(chooser.choose(far)).toEqual([{ creatureId: 'owned', moveId: 'strike' }]);
  });

  it('never chooses a Bolt or Arc without a line to the enemy', () => {
    const owned = creature({
      lineToEnemy: false,
      moves: [move('bolt', { needsLine: true }), move('arc', { needsLine: true })],
    });
    expect(createChooser(() => 0).choose(input(owned))).toEqual([]);
  });

  it('still chooses a contact move without a line', () => {
    const owned = creature({ lineToEnemy: false, moves: [move('strike')] });
    expect(createChooser(() => 0).choose(input(owned))).toEqual([
      { creatureId: 'owned', moveId: 'strike' },
    ]);
  });

  it('is deterministic for the same rng sequence', () => {
    const run = () => {
      const values = [0.8, 0.2];
      return createChooser(() => values.shift()!).choose(
        input(creature({ temperament: 'Erratic', moves: [move('a'), move('b')] })),
      );
    };
    expect(run()).toEqual(run());
  });
});
