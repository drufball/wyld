import { describe, expect, it } from 'vitest';
import { formation, type FormationCreature, type FormationInput } from './formation.js';

const creature = (overrides: Partial<FormationCreature> = {}): FormationCreature => ({
  id: 'one',
  temperament: 'Steady',
  tile: { x: 5.5, y: 5.5 },
  home: { x: 5.5, y: 5.5 },
  hp: 10,
  maxHp: 10,
  moves: [{ rangeTiles: 2, power: 1, ready: true }],
  wander: null,
  ...overrides,
});
const run = (creatures: FormationCreature[], overrides: Partial<FormationInput> = {}) =>
  formation({
    player: { x: 0.5, y: 0.5 },
    enemy: { x: 0.5, y: -9.5 },
    creatures,
    isWalkable: () => true,
    rng: () => 0,
    dt: 1,
    ...overrides,
  });
const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('formation', () => {
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
          { rangeTiles: 5, power: 9, ready: true },
          { rangeTiles: 2, power: 10, ready: false },
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
