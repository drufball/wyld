import { describe, expect, it } from 'vitest';
import {
  formation,
  ringFor,
  ringTarget,
  shotHolds,
  type FormationCreature,
  type FormationInput,
} from './formation.js';

const creature = (overrides: Partial<FormationCreature> = {}): FormationCreature => ({
  id: 'one',
  temperament: 'Steady',
  tile: { x: 5.5, y: 5.5 },
  home: { x: 5.5, y: 5.5 },
  hp: 10,
  maxHp: 10,
  moves: [{ rangeTiles: 2, power: 1, cooldownTotal: 1, ready: true, ranged: false }],
  wander: null,
  ...overrides,
});
const run = (creatures: FormationCreature[], overrides: Partial<FormationInput> = {}) =>
  formation({
    player: { x: 0.5, y: 0.5 },
    enemy: { x: 0.5, y: -9.5 },
    enemyReach: 1.25,
    creatures,
    isWalkable: () => true,
    rng: () => 0,
    dt: 1,
    ...overrides,
  });
const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('formation', () => {
  const bolt = { rangeTiles: 10, power: 1, cooldownTotal: 1, ready: true, ranged: true };

  it('walks a Bold shooter out to its ring', () => {
    const enemy = { x: 0.5, y: 0.5 };
    let c = creature({ temperament: 'Bold', tile: { x: 0.5, y: 2 }, moves: [bolt] });
    const initial = d(c.tile, enemy);
    for (let i = 0; i < 20; i += 1) {
      const tile = run([c], { enemy })[0]!.tile;
      c = { ...c, tile };
    }
    const ring = ringFor('Bold', [bolt], 2);
    expect(ring).toBe(4.25);
    expect(d(c.tile, enemy)).toBeGreaterThanOrEqual(ring! - 0.6);
    expect(d(c.tile, enemy)).toBeLessThanOrEqual(ring! + 1.2);
    expect(d(c.tile, enemy)).toBeGreaterThan(initial);
  });

  it('walks a Bold shooter in to its ring', () => {
    const enemy = { x: 0.5, y: 0.5 };
    let c = creature({ temperament: 'Bold', tile: { x: 0.5, y: 6.5 }, moves: [bolt] });
    const initial = d(c.tile, enemy);
    for (let i = 0; i < 20; i += 1) {
      const tile = run([c], { enemy })[0]!.tile;
      c = { ...c, tile };
    }
    expect(d(c.tile, enemy)).toBeGreaterThanOrEqual(4.25 - 0.6);
    expect(d(c.tile, enemy)).toBeLessThanOrEqual(4.25 + 1.2);
    expect(d(c.tile, enemy)).toBeLessThan(initial);
  });

  it('gives a Steady creature with only Strikes no ring', () => {
    const c = creature({ tile: { x: 0.5, y: -2.5 } });
    expect(ringFor(c.temperament, c.moves, 2)).toBeNull();
    expect(run([c])[0]!.tile).toEqual({ x: 0.5, y: -2.5 });
  });

  it('gives a Bold tank with a Strike and an Arc no ring', () => {
    const moves = [
      { rangeTiles: 1.25, power: 5, cooldownTotal: 1, ready: true, ranged: false },
      { rangeTiles: 7.5, power: 4, cooldownTotal: 1, ready: true, ranged: true },
    ];
    expect(ringFor('Bold', moves, 2)).toBeNull();
  });

  it('holds a Skittish shooter that is already on its ring', () => {
    const c = creature({
      temperament: 'Skittish',
      tile: { x: 0.5, y: 4.5 },
      moves: [bolt],
    });
    expect(ringTarget(c, { x: 0, y: 0 }, 2, () => true)).toEqual(c.tile);
  });

  it('puts the ring outside the hold-the-shot release line', () => {
    for (const reach of [0, 1.25, 2, 3, 4]) {
      const ring = ringFor('Skittish', [bolt], reach);
      expect(ring === null ? true : !shotHolds(ring, reach)).toBe(true);
    }
  });

  it('uses the 3.5-tile kite line against a Strike-only heavy', () => {
    expect(ringFor('Skittish', [bolt], 1.25)).toBe(3.5);
  });
  it('keeps a Skittish creature within two tiles of the player on the far side from the enemy', () => {
    const tile = run([creature({ temperament: 'Skittish' })])[0]!.tile;
    expect(d(tile, { x: 0.5, y: 0.5 })).toBe(2);
    expect(d(tile, { x: 0.5, y: -9.5 })).toBe(12);
  });
  it('holds a Skittish creature that is already tucked behind the player', () => {
    expect(run([creature({ temperament: 'Skittish', tile: { x: 0.5, y: 1.5 } })])[0]!.tile).toEqual(
      { x: 0.5, y: 1.5 },
    );
  });
  it('holds a Steady creature two to three tiles from the player toward the enemy', () => {
    expect(run([creature({ tile: { x: 0.5, y: -2.5 } })])[0]!.tile).toEqual({ x: 0.5, y: -2.5 });
  });
  it("sends a Bold creature to its best ready move's range from the enemy", () => {
    const tile = run([
      creature({
        temperament: 'Bold',
        tile: { x: 0.5, y: 0.5 },
        moves: [
          { rangeTiles: 5, power: 9, cooldownTotal: 1, ready: true, ranged: false },
          { rangeTiles: 2, power: 10, cooldownTotal: 1, ready: false, ranged: false },
        ],
      }),
    ])[0]!.tile;
    expect(d(tile, { x: 0.5, y: -9.5 })).toBe(5);
  });
  it('pulls a Bold creature back to the Steady spot below thirty percent hp', () => {
    expect(run([creature({ temperament: 'Bold', hp: 2, maxHp: 10 })])[0]!.tile).toEqual({
      x: 0.5,
      y: -1.5,
    });
  });
  it('lets an Erratic creature wander within four tiles of its own spot', () => {
    let c = creature({
        temperament: 'Erratic',
        tile: { x: 10.5, y: 10.5 },
        home: { x: 10.5, y: 10.5 },
      }),
      changed = false,
      previous = '';
    const values = [0, 0.25, 0.1, 0.75, 0.9, 0.5];
    let i = 0;
    for (let tick = 0; tick < 8; tick++) {
      const out = run([c], {
        player: { x: 0, y: 0 },
        rng: () => values[i++ % values.length]!,
        dt: 3,
      })[0]!;
      expect(d(out.tile, c.home)).toBeLessThanOrEqual(4);
      changed ||= previous !== '' && previous !== JSON.stringify(out.tile);
      previous = JSON.stringify(out.tile);
      c = { ...c, tile: out.tile, wander: out.wander };
    }
    expect(changed).toBe(true);
  });
  it('makes an Erratic creature hold like Steady while the player is within two tiles', () => {
    expect(
      run([creature({ temperament: 'Erratic', tile: { x: 0.5, y: 1.5 } })])[0]!.wander,
    ).toBeNull();
  });
  it('is deterministic for the same rng sequence', () => {
    const once = () => {
      let i = 0;
      const sequence = [0.2, 0.4, 0.6];
      return run([creature({ temperament: 'Erratic' })], {
        player: { x: 0, y: 0 },
        rng: () => sequence[i++ % 3]!,
      });
    };
    expect(once()).toEqual(once());
  });
  it('backs a Skittish Bolt-holder one tile off when the enemy comes within reach', () => {
    expect(
      run(
        [
          creature({
            temperament: 'Skittish',
            tile: { x: 0.5, y: 0.5 },
            moves: [{ rangeTiles: 10, power: 1, cooldownTotal: 1, ready: true, ranged: true }],
          }),
        ],
        { enemy: { x: 0.5, y: -1.5 }, player: { x: 5.5, y: 5.5 } },
      )[0]!.tile,
    ).toEqual({ x: 0.5, y: 1.5 });
  });
  it('holds instead of stepping out of its own range', () => {
    expect(
      run(
        [
          creature({
            temperament: 'Skittish',
            tile: { x: 0.5, y: 0.5 },
            moves: [{ rangeTiles: 2.2, power: 1, cooldownTotal: 1, ready: true, ranged: true }],
          }),
        ],
        { enemy: { x: 0.5, y: -1.5 }, player: { x: 0.5, y: 1.5 } },
      )[0]!.tile,
    ).toEqual({ x: 0.5, y: 0.5 });
  });
  it('steps aside when straight back is a rock', () => {
    const tile = run(
      [
        creature({
          temperament: 'Skittish',
          tile: { x: 0.5, y: 0.5 },
          moves: [{ rangeTiles: 10, power: 1, cooldownTotal: 1, ready: true, ranged: true }],
        }),
      ],
      {
        enemy: { x: 0.5, y: -1.5 },
        player: { x: 0.5, y: 1.5 },
        isWalkable: (x, y) => !(x === 0 && y === 1),
      },
    )[0]!.tile;
    expect(tile).toEqual({ x: -0.5, y: 1.5 });
  });
  it('does not kite without a ranged move', () => {
    expect(
      run([creature({ temperament: 'Skittish', tile: { x: 0.5, y: 0.5 } })], {
        enemy: { x: 0.5, y: -1.5 },
        player: { x: 0.5, y: 1.5 },
      })[0]!.tile,
    ).toEqual({ x: 0.5, y: 3.5 });
  });
  it('walks a Skittish shooter toward its ring while the enemy is out of reach', () => {
    expect(
      run(
        [
          creature({
            temperament: 'Skittish',
            tile: { x: 0.5, y: 0.5 },
            moves: [{ rangeTiles: 10, power: 1, cooldownTotal: 1, ready: true, ranged: true }],
          }),
        ],
        { enemy: { x: 0.5, y: -8.5 }, player: { x: 0.5, y: 1.5 } },
      )[0]!.tile,
    ).toEqual({ x: 0.5, y: -0.5 });
  });
  it('keeps a Skittish creature with no ranged move behind the player', () => {
    expect(
      run([creature({ temperament: 'Skittish', tile: { x: 0.5, y: 0.5 } })], {
        enemy: { x: 0.5, y: -8.5 },
        player: { x: 0.5, y: 1.5 },
      })[0]!.tile,
    ).toEqual({ x: 0.5, y: 3.5 });
  });
  it("never gives two creatures the same tile, nor the player's, the enemy's or a rock", () => {
    const cs = [0, 1, 2].map((i) => creature({ id: `${i}`, tile: { x: 4 + i, y: 4 } }));
    const out = run(cs, {
      player: { x: 0.5, y: -2.5 },
      enemy: { x: 0.5, y: -4.5 },
      isWalkable: (x, y) => !(x === 1 && y === -2),
    });
    const keys = out.map((x) => `${Math.floor(x.tile.x)},${Math.floor(x.tile.y)}`);
    expect(new Set(keys).size).toBe(3);
    expect(keys).not.toContain('0,-2');
    expect(keys).not.toContain('0,-5');
    expect(keys).not.toContain('1,-2');
  });
});
