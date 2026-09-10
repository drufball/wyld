import { describe, expect, it } from 'vitest';
import { separate } from './spacing.js';

const open = () => true;

describe('combat spacing', () => {
  it('pushes two overlapping combatants a tile apart', () => {
    const result = separate(
      [
        { id: 'a', tile: { x: 0, y: 0 }, maxStep: 1 },
        { id: 'b', tile: { x: 0.5, y: 0 }, maxStep: 1 },
      ],
      open,
    );
    expect(Math.hypot(result.a!.x - result.b!.x, result.a!.y - result.b!.y)).toBe(1);
  });

  it('separates exactly coincident combatants deterministically', () => {
    const bodies = [
      { id: 'first', tile: { x: 2, y: 2 }, maxStep: 1 },
      { id: 'second', tile: { x: 2, y: 2 }, maxStep: 1 },
    ];
    expect(separate(bodies, open)).toEqual({
      first: { x: 1.5, y: 2 },
      second: { x: 2.5, y: 2 },
    });
    expect(separate(bodies, open)).toEqual(separate(bodies, open));
  });

  it('never pushes a combatant further than its step allows', () => {
    const result = separate(
      [
        { id: 'a', tile: { x: 0, y: 0 }, maxStep: 0.1 },
        { id: 'b', tile: { x: 0, y: 0 }, maxStep: 0.2 },
      ],
      open,
    );
    expect(Math.hypot(result.a!.x, result.a!.y)).toBeCloseTo(0.1);
    expect(Math.hypot(result.b!.x, result.b!.y)).toBeCloseTo(0.2);
  });

  it('refuses a push that would land a combatant on a rock', () => {
    const result = separate(
      [
        { id: 'a', tile: { x: 1.1, y: 1.5 }, maxStep: 1 },
        { id: 'b', tile: { x: 1.5, y: 1.5 }, maxStep: 1 },
      ],
      (x, y) => !(x === 0 && y === 1),
    );
    expect(result.a).toEqual({ x: 1.1, y: 1.5 });
    expect(result.b!.x).toBeGreaterThan(1.5);
  });

  it('leaves combatants that are already a tile apart alone', () => {
    const bodies = [
      { id: 'a', tile: { x: 1, y: 1 }, maxStep: 1 },
      { id: 'b', tile: { x: 2, y: 1 }, maxStep: 1 },
    ];
    expect(separate(bodies, open)).toEqual({ a: { x: 1, y: 1 }, b: { x: 2, y: 1 } });
  });
});
